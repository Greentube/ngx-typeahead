/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
beforeEach(function () {
    jasmine.addMatchers({
        toHaveText: function () {
            return {
                compare: function (actual, expectedText) {
                    var actualText = actual.textContent;
                    return {
                        pass: actualText === expectedText,
                        get message() {
                            return 'Expected ' + actualText + ' to equal ' + expectedText;
                        }
                    };
                }
            };
        },
        toContainText: function () {
            return {
                compare: function (actual, expectedText) {
                    var actualText = actual.textContent;
                    return {
                        pass: actualText.indexOf(expectedText) > -1,
                        get message() {
                            return 'Expected ' + actualText + ' to contain ' + expectedText;
                        }
                    };
                }
            };
        }
    });
});
