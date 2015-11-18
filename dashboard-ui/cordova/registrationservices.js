﻿(function () {

    function getRegistrationInfo(feature) {

        return ConnectionManager.getRegistrationInfo(feature, ApiClient);
    }

    function validateFeature(feature, deferred) {

        var unlockableProduct = IapManager.getProductInfo(feature) || {};

        if (unlockableProduct.owned) {
            deferred.resolve();
            return;
        }

        var unlockableProductInfo = IapManager.isPurchaseAvailable(feature) ? {
            enableAppUnlock: true,
            id: unlockableProduct.id,
            price: unlockableProduct.price,
            feature: feature

        } : null;

        var prefix = $.browser.android ? 'android' : 'ios';

        IapManager.isUnlockedOverride(feature).done(function (isUnlocked) {

            if (isUnlocked) {
                deferred.resolve();
                return;
            }

            function onRegistrationInfoResponse(registrationInfo) {

                if (registrationInfo.IsRegistered) {
                    deferred.resolve();
                    return;
                }

                IapManager.getSubscriptionOptions().done(function (subscriptionOptions) {

                    if (subscriptionOptions.filter(function (p) {
                        return p.owned;
                    }).length > 0) {
                        deferred.resolve();
                        return;
                    }

                    var dialogOptions = {
                        title: Globalize.translate('HeaderUnlockApp'),
                        enablePlayMinute: feature == 'playback',
                        feature: feature
                    };

                    showInAppPurchaseInfo(subscriptionOptions, unlockableProductInfo, dialogOptions, deferred);
                });
            }

            // Get supporter status
            getRegistrationInfo(prefix + 'appunlock').done(onRegistrationInfoResponse).fail(function () {
                onRegistrationInfoResponse({});
            });
        });
    }

    function cancelInAppPurchase() {

        var elem = document.querySelector('.inAppPurchaseOverlay');
        if (elem) {
            PaperDialogHelper.close(elem);
        }
    }

    var isCancelled = true;
    var currentDisplayingProductInfos = [];
    var currentDisplayingDeferred = null;

    function clearCurrentDisplayingInfo() {
        currentDisplayingProductInfos = [];
        currentDisplayingDeferred = null;
    }

    function showInAppPurchaseElement(subscriptionOptions, unlockableProductInfo, dialogOptions, deferred) {

        cancelInAppPurchase();

        // clone
        currentDisplayingProductInfos = subscriptionOptions.slice(0);

        if (unlockableProductInfo) {
            currentDisplayingProductInfos.push(unlockableProductInfo);
        }

        var dlg = PaperDialogHelper.createDialog();

        var html = '';
        html += '<h2 class="dialogHeader">';
        html += '<paper-fab icon="arrow-back" mini class="btnCloseDialog"></paper-fab>';
        html += '<div style="display:inline-block;margin-left:.6em;vertical-align:middle;">' + dialogOptions.title + '</div>';
        html += '</h2>';

        html += '<div class="editorContent">';

        html += '<form style="max-width: 800px;margin:auto;">';
        html += '<p style="margin:2em 0;">';

        if (unlockableProductInfo) {
            html += Globalize.translate('MessageUnlockAppWithPurchaseOrSupporter');
        }
        else {
            html += Globalize.translate('MessageUnlockAppWithSupporter');
        }
        html += '</p>';

        html += '<p style="margin:2em 0;">';
        html += Globalize.translate('MessageToValidateSupporter');
        html += '</p>';

        var hasProduct = false;

        if (unlockableProductInfo) {

            hasProduct = true;
            var unlockText = Globalize.translate('ButtonUnlockWithPurchase');
            if (unlockableProductInfo.price) {
                unlockText = Globalize.translate('ButtonUnlockPrice', unlockableProductInfo.price);
            }
            html += '<p>';
            html += '<paper-button raised class="secondary block btnPurchase" data-feature="' + unlockableProductInfo.feature + '"><iron-icon icon="check"></iron-icon><span>' + unlockText + '</span></paper-button>';
            html += '</p>';
        }

        for (var i = 0, length = subscriptionOptions.length; i < length; i++) {

            hasProduct = true;
            html += '<p>';
            html += '<paper-button raised class="submit block btnPurchase" data-email="true" data-feature="' + subscriptionOptions[i].feature + '"><iron-icon icon="check"></iron-icon><span>';
            html += subscriptionOptions[i].buttonText;
            html += '</span></paper-button>';
            html += '</p>';
        }

        if (hasProduct && IapManager.restorePurchase) {
            html += '<p>';
            html += '<paper-button raised class="secondary block btnRestorePurchase" style="background-color: #673AB7;"><iron-icon icon="check"></iron-icon><span>' + Globalize.translate('ButtonRestorePreviousPurchase') + '</span></paper-button>';
            html += '</p>';
        }

        if (dialogOptions.enablePlayMinute) {
            html += '<p>';
            html += '<paper-button raised class="secondary block btnCloseDialog subdued"><iron-icon icon="play-arrow"></iron-icon><span>' + Globalize.translate('ButtonPlayTwoMinutes') + '</span></paper-button>';
            html += '</p>';
        }

        html += '</form>';
        html += '</div>';

        dlg.innerHTML = html;
        document.body.appendChild(dlg);

        initInAppPurchaseElementEvents(dlg, dialogOptions.feature, deferred);

        PaperDialogHelper.openWithHash(dlg, 'iap');

        $('.btnCloseDialog', dlg).on('click', function () {

            PaperDialogHelper.close(dlg);
        });

        $(dlg).on('iron-overlay-closed', function () {

            if (window.TabBar) {
                TabBar.show();
            }
        });

        dlg.classList.add('inAppPurchaseOverlay');
    }

    function initInAppPurchaseElementEvents(elem, feature, deferred) {

        isCancelled = true;

        $('.btnPurchase', elem).on('click', function () {

            isCancelled = false;

            if (this.getAttribute('data-email') == 'true') {
                promptForEmail(this.getAttribute('data-feature'));
            } else {
                IapManager.beginPurchase(this.getAttribute('data-feature'));
            }
        });

        $('.btnRestorePurchase', elem).on('click', function () {

            isCancelled = false;
            IapManager.restorePurchase();
        });

        $(elem).on('iron-overlay-closed', function () {

            clearCurrentDisplayingInfo();

            var overlay = this;

            if (isCancelled) {

                if (feature == 'playback') {
                    Dashboard.alert({
                        message: Globalize.translate('ThankYouForTryingEnjoyOneMinute'),
                        title: Globalize.translate('HeaderTryPlayback'),
                        callback: function () {
                            deferred.reject();
                            $(overlay).remove();
                        }
                    });
                } else {
                    deferred.reject();
                    $(overlay).remove();
                }

            } else {
                $(this).remove();
            }
        });
    }

    function showInAppPurchaseInfo(subscriptionOptions, unlockableProductInfo, dialogOptions, deferred) {

        require(['components/paperdialoghelper'], function () {

            if (window.TabBar) {
                TabBar.hide();
            }

            showInAppPurchaseElement(subscriptionOptions, unlockableProductInfo, dialogOptions, deferred);

            currentDisplayingDeferred = deferred;
        });
    }

    function promptForEmail(feature) {

        require(['prompt'], function (prompt) {

            prompt({
                text: Globalize.translate('TextPleaseEnterYourEmailAddressForSubscription'),
                title: Globalize.translate('HeaderEmailAddress'),
                callback: function (email) {

                    if (email) {
                        IapManager.beginPurchase(feature, email);
                    }
                }
            });
        });
    }

    function onProductUpdated(e, product) {

        if (product.owned) {

            var deferred = currentDisplayingDeferred;

            if (deferred && currentDisplayingProductInfos.filter(function (p) {

                return product.id == p.id;

            }).length) {

                isCancelled = false;

                cancelInAppPurchase();
                deferred.resolve();
            }
        }
    }

    function validateSync(deferred) {

        Dashboard.getPluginSecurityInfo().done(function (pluginSecurityInfo) {

            if (pluginSecurityInfo.IsMBSupporter) {
                deferred.resolve();
                return;
            }

            function onRegistrationInfoResponse(registrationInfo) {
                if (registrationInfo.IsRegistered) {
                    deferred.resolve();
                    return;
                }

                IapManager.getSubscriptionOptions().done(function (subscriptionOptions) {

                    var dialogOptions = {
                        title: Globalize.translate('HeaderUnlockSync'),
                        feature: 'sync'
                    };

                    showInAppPurchaseInfo(subscriptionOptions, null, dialogOptions, deferred);
                });
            }

            // Get supporter status
            getRegistrationInfo('Sync').done(onRegistrationInfoResponse).fail(function () {
                onRegistrationInfoResponse({});
            });
        });
    }

    window.RegistrationServices = {

        renderPluginInfo: function (page, pkg, pluginSecurityInfo) {


        },

        validateFeature: function (name) {
            var deferred = DeferredBuilder.Deferred();

            if (name == 'playback') {
                validateFeature(name, deferred);
            } else if (name == 'livetv') {
                validateFeature(name, deferred);
            } else if (name == 'sync') {
                validateSync(deferred);
            } else {
                deferred.resolve();
            }

            return deferred.promise();
        }
    };

    function onIapManagerLoaded() {
        Events.on(IapManager, 'productupdated', onProductUpdated);
    }

    if ($.browser.android) {
        requirejs(['cordova/android/iap'], onIapManagerLoaded);
    } else {
        requirejs(['cordova/iap'], onIapManagerLoaded);
    }

})();