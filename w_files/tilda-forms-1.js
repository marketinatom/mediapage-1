(function(factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory)
    } else {
        if (typeof exports === 'object') {
            factory(require('jquery'))
        } else {
            factory(jQuery)
        }
    }
}(function($) {
    var ua = navigator.userAgent,
        iPhone = /iphone/i.test(ua),
        chrome = /chrome/i.test(ua),
        android = /android/i.test(ua),
        caretTimeoutId;
    $.mask = {
        definitions: {
            '9': "[0-9]",
            'a': "[A-Za-z]",
            'а': "[А-Яа-яЁё]",
            '*': "[A-Za-zА-Яа-яЁё0-9]"
        },
        autoclear: !0,
        dataName: "rawMaskFn",
        placeholder: '_'
    };
    $.fn.extend({
        caret: function(begin, end) {
            var range;
            if (this.length === 0 || this.is(":hidden") || this.get(0) !== document.activeElement) {
                return
            }
            if (typeof begin == 'number') {
                end = (typeof end === 'number') ? end : begin;
                return this.each(function() {
                    if (this.setSelectionRange) {
                        this.setSelectionRange(begin, end)
                    } else {
                        if (this.createTextRange) {
                            range = this.createTextRange();
                            range.collapse(!0);
                            range.moveEnd('character', end);
                            range.moveStart('character', begin);
                            range.select()
                        }
                    }
                })
            } else {
                if (this[0].setSelectionRange) {
                    begin = this[0].selectionStart;
                    end = this[0].selectionEnd
                } else {
                    if (document.selection && document.selection.createRange) {
                        range = document.selection.createRange();
                        begin = 0 - range.duplicate().moveStart('character', -100000);
                        end = begin + range.text.length
                    }
                }
                return {
                    begin: begin,
                    end: end
                }
            }
        },
        unmask: function() {
            return this.trigger("unmask")
        },
        mask: function(mask, settings) {
            var input, defs, tests, partialPosition, firstNonMaskPos, lastRequiredNonMaskPos, len, oldVal;
            if (!mask && this.length > 0) {
                input = $(this[0]);
                var fn = input.data($.mask.dataName)
                return fn ? fn() : undefined
            }
            settings = $.extend({
                autoclear: $.mask.autoclear,
                placeholder: $.mask.placeholder,
                completed: null
            }, settings);
            defs = $.mask.definitions;
            tests = [];
            partialPosition = len = mask.length;
            firstNonMaskPos = null;
            mask = String(mask);
            $.each(mask.split(""), function(i, c) {
                if (c == '?') {
                    len--;
                    partialPosition = i
                } else {
                    if (defs[c]) {
                        tests.push(new RegExp(defs[c]));
                        if (firstNonMaskPos === null) {
                            firstNonMaskPos = tests.length - 1
                        }
                        if (i < partialPosition) {
                            lastRequiredNonMaskPos = tests.length - 1
                        }
                    } else {
                        tests.push(null)
                    }
                }
            });
            return this.trigger("unmask").each(function() {
                var input = $(this),
                    buffer = $.map(mask.split(""), function(c, i) {
                        if (c != '?') {
                            return defs[c] ? getPlaceholder(i) : c
                        }
                    }),
                    defaultBuffer = buffer.join(''),
                    focusText = input.val();

                function tryFireCompleted() {
                    if (!settings.completed) {
                        return
                    }
                    for (var i = firstNonMaskPos; i <= lastRequiredNonMaskPos; i++) {
                        if (tests[i] && buffer[i] === getPlaceholder(i)) {
                            return
                        }
                    }
                    settings.completed.call(input)
                }

                function getPlaceholder(i) {
                    if (i < settings.placeholder.length) {
                        return settings.placeholder.charAt(i)
                    }
                    return settings.placeholder.charAt(0)
                }

                function seekNext(pos) {
                    while (++pos < len && !tests[pos]);
                    return pos
                }

                function seekPrev(pos) {
                    while (--pos >= 0 && !tests[pos]);
                    return pos
                }

                function shiftL(begin, end) {
                    var i, j;
                    if (begin < 0) {
                        return
                    }
                    for (i = begin, j = seekNext(end); i < len; i++) {
                        if (tests[i]) {
                            if (j < len && tests[i].test(buffer[j])) {
                                buffer[i] = buffer[j];
                                buffer[j] = getPlaceholder(j)
                            } else {
                                break
                            }
                            j = seekNext(j)
                        }
                    }
                    writeBuffer();
                    input.caret(Math.max(firstNonMaskPos, begin))
                }

                function shiftR(pos) {
                    var i, c, j, t;
                    for (i = pos, c = getPlaceholder(pos); i < len; i++) {
                        if (tests[i]) {
                            j = seekNext(i);
                            t = buffer[i];
                            buffer[i] = c;
                            if (j < len && tests[j].test(t)) {
                                c = t
                            } else {
                                break
                            }
                        }
                    }
                }

                function androidInputEvent(e) {
                    var curVal = input.val();
                    var pos = input.caret();
                    var proxy = function() {
                        $.proxy($.fn.caret, input, pos.begin, pos.begin)()
                    };
                    if (oldVal && oldVal.length && oldVal.length > curVal.length) {
                        var nextPos = checkVal(!0);
                        var curPos = pos.end;
                        while (curPos > 0 && !tests[curPos - 1]) {
                            curPos--
                        }
                        if (curPos === 0) {
                            curPos = nextPos
                        }
                        pos.begin = curPos;
                        setTimeout(function() {
                            proxy();
                            tryFireCompleted()
                        }, 0)
                    } else {
                        pos.begin = checkVal(!0);
                        setTimeout(function() {
                            proxy();
                            tryFireCompleted()
                        }, 0)
                    }
                }

                function blurEvent(e) {
                    checkVal();
                    if (input.val() != focusText) {
                        input.change()
                    }
                }

                function keydownEvent(e) {
                    if (input.prop("readonly")) {
                        return
                    }
                    var k = e.which || e.keyCode,
                        pos, begin, end;
                    oldVal = input.val();
                    if (k === 8 || k === 46 || (iPhone && k === 127)) {
                        pos = input.caret();
                        begin = pos.begin;
                        end = pos.end;
                        if (end - begin === 0) {
                            begin = k !== 46 ? seekPrev(begin) : (end = seekNext(begin - 1));
                            end = k === 46 ? seekNext(end) : end
                        }
                        clearBuffer(begin, end);
                        shiftL(begin, end - 1);
                        e.preventDefault()
                    } else {
                        if (k === 13) {
                            blurEvent.call(this, e)
                        } else {
                            if (k === 27) {
                                input.val(focusText);
                                input.caret(0, checkVal());
                                e.preventDefault()
                            }
                        }
                    }
                }

                function keypressEvent(e) {
                    if (input.prop("readonly")) {
                        return
                    }
                    var k = e.which || e.keyCode,
                        pos = input.caret(),
                        p, c, next;
                    if (e.ctrlKey || e.altKey || e.metaKey || k < 32) {
                        return
                    } else {
                        if (k && k !== 13) {
                            if (pos.end - pos.begin !== 0) {
                                clearBuffer(pos.begin, pos.end);
                                shiftL(pos.begin, pos.end - 1)
                            }
                            p = seekNext(pos.begin - 1);
                            if (p < len) {
                                c = String.fromCharCode(k);
                                if (tests[p].test(c)) {
                                    shiftR(p);
                                    buffer[p] = c;
                                    writeBuffer();
                                    next = seekNext(p);
                                    if (android) {
                                        var proxy = function() {
                                            $.proxy($.fn.caret, input, next)()
                                        };
                                        setTimeout(proxy, 0)
                                    } else {
                                        input.caret(next)
                                    }
                                    if (pos.begin <= lastRequiredNonMaskPos) {
                                        tryFireCompleted()
                                    }
                                }
                            }
                            e.preventDefault()
                        }
                    }
                }

                function clearBuffer(start, end) {
                    var i;
                    for (i = start; i < end && i < len; i++) {
                        if (tests[i]) {
                            buffer[i] = getPlaceholder(i)
                        }
                    }
                }

                function writeBuffer() {
                    input.val(buffer.join(''))
                }

                function checkVal(allow) {
                    var test = input.val(),
                        lastMatch = -1,
                        i, c, pos;
                    for (i = 0, pos = 0; i < len; i++) {
                        if (tests[i]) {
                            buffer[i] = getPlaceholder(i);
                            while (pos++ < test.length) {
                                c = test.charAt(pos - 1);
                                if (tests[i].test(c)) {
                                    buffer[i] = c;
                                    lastMatch = i;
                                    break
                                }
                            }
                            if (pos > test.length) {
                                clearBuffer(i + 1, len);
                                break
                            }
                        } else {
                            if (buffer[i] === test.charAt(pos)) {
                                pos++
                            }
                            if (i < partialPosition) {
                                lastMatch = i
                            }
                        }
                    }
                    if (allow) {
                        writeBuffer()
                    } else {
                        if (lastMatch + 1 < partialPosition) {
                            if (settings.autoclear || buffer.join('') === defaultBuffer) {
                                if (input.val()) input.val("");
                                clearBuffer(0, len)
                            } else {
                                writeBuffer()
                            }
                        } else {
                            writeBuffer();
                            input.val(input.val().substring(0, lastMatch + 1))
                        }
                    }
                    return (partialPosition ? i : firstNonMaskPos)
                }
                input.data($.mask.dataName, function() {
                    return $.map(buffer, function(c, i) {
                        return tests[i] && c != getPlaceholder(i) ? c : null
                    }).join('')
                });
                input.one("unmask", function() {
                    input.off(".mask").removeData($.mask.dataName)
                }).on("focus.mask", function() {
                    if (input.prop("readonly")) {
                        return
                    }
                    clearTimeout(caretTimeoutId);
                    var pos;
                    focusText = input.val();
                    pos = checkVal();
                    caretTimeoutId = setTimeout(function() {
                        if (input.get(0) !== document.activeElement) {
                            return
                        }
                        writeBuffer();
                        if (pos == mask.replace("?", "").length) {
                            input.caret(0, pos)
                        } else {
                            input.caret(pos)
                        }
                    }, 10)
                }).on("blur.mask", blurEvent).on("keydown.mask", keydownEvent).on("keypress.mask", keypressEvent).on("input.mask paste.mask", function() {
                    if (input.prop("readonly")) {
                        return
                    }
                    setTimeout(function() {
                        var pos = checkVal(!0);
                        input.caret(pos);
                        tryFireCompleted()
                    }, 0)
                });
                if (chrome && android) {
                    input.off('input.mask').on('input.mask', androidInputEvent)
                }
                checkVal()
            })
        }
    })
}));
(function($) {
    window.tildaBrowserLang = window.navigator.userLanguage || window.navigator.language;
    window.tildaBrowserLang = window.tildaBrowserLang.toUpperCase();
    if (window.tildaBrowserLang.indexOf('RU') != -1) {
        window.tildaBrowserLang = 'RU'
    } else {
        window.tildaBrowserLang = 'EN'
    }
    window.scriptSysPayment = {};
    window.handlerSysPayment = {};
    window.tildaForm = {
        versionLib: '01.001',
        endpoint: 'forms.tildacdn.com',
        isRecaptchaScriptInit: !1,
        currentFormProccessing: !1,
        arMessages: {
            'EN': {
                'success': 'Thank you! Your data has been submitted.',
                'successorder': 'Thank you! Order created. Please wait. We are going to the payment...'
            },
            'RU': {
                'success': 'Спасибо! Данные успешно отправлены.',
                'successorder': 'Спасибо! Заказ оформлен. Пожалуйста, подождите. Идет переход к оплате....'
            }
        },
        arValidateErrors: {
            'EN': {
                'email': 'Please put a correct e-mail',
                'url': 'Please put a correct URL',
                'phone': 'Please put a correct phone number',
                'number': 'Please put a correct number',
                'date': 'Please put a correct date',
                'time': 'Please put a correct time (HH:mm)',
                'name': 'Please put a name',
                'namerus': 'Please put a correct name (only cyrillic letters)',
                'nameeng': 'Please put a correct name (only latin letters)',
                'string': 'You put incorrect symbols. Only letters, numbers and punctuation symbols are allowed',
                'req': 'Please fill out all required fields',
                'reqfield': 'Required field',
                'minlength': 'Value is too short',
                'maxlength': 'Value too big',
                'emptyfill': 'None of the fields are filled in',
                'chosevalue': 'Please select an address from the options'
            },
            'RU': {
                'email': 'Укажите, пожалуйста, корректный email',
                'url': 'Укажите, пожалуйста, корректный URL',
                'phone': 'Укажите, пожалуйста, корректный номер телефона',
                'number': 'Укажите, пожалуйста, корректный номер',
                'date': 'Укажите, пожалуйста, корректную дату',
                'time': 'Укажите, пожалуйста, корректное время (ЧЧ:ММ)',
                'name': 'Укажите, пожалуйста, имя',
                'namerus': 'Укажите, пожалуйста, имя (только кириллица)',
                'nameeng': 'Укажите, пожалуйста, имя (только латиница)',
                'string': 'Вы написали некорректные символы. Разрешены только буквы, числа и знаки пунктуации',
                'req': 'Пожалуйста, заполните все обязательные поля',
                'minlength': 'Слишком короткое значение',
                'maxlength': 'Слишком длинное',
                'reqfield': 'Обязательное поле',
                'emptyfill': 'Ни одно поле не заполнено',
                'chosevalue': 'Пожалуйста, выберите адрес из предложенных вариантов'
            }
        }
    };
    $(document).ready(function() {
        window.tildaForm.captchaCallback = function(token) {
            if (!window.tildaForm.currentFormProccessing || !window.tildaForm.currentFormProccessing.form) {
                return !1
            }
            window.tildaForm.send(window.tildaForm.currentFormProccessing.form, window.tildaForm.currentFormProccessing.btn, window.tildaForm.currentFormProccessing.formtype, window.tildaForm.currentFormProccessing.formskey);
            window.tildaForm.currentFormProccessing = !1
        }
        window.tildaForm.validate = function($jform) {
            var arError = [];
            var isEmptyValue = !0;
            $jform.find('.js-tilda-rule').each(function() {
                var req = $(this).data('tilda-req') || 0;
                var rule = $(this).data('tilda-rule') || 'none',
                    regExp, str, domainpart;
                var minlength = $(this).data('tilda-rule-minlength') || 0;
                var maxlength = $(this).data('tilda-rule-maxlength') || 0;
                var error = {};
                var val = $(this).val();
                var valnospace = '';
                error.obj = $(this);
                error.type = [];
                if (val && val.length > 0) {
                    try {
                        valnospace = val.replace(/[\s\u0000—\u001F\u2000-\u200F\uFEFF\u2028-\u202F\u205F-\u206F]/gi, '')
                    } catch (e) {}
                    val = val.trim()
                }
                if (val.length > 0) {
                    isEmptyValue = !1
                }
                if (minlength) {
                    minlength = parseInt(minlength)
                }
                if (maxlength) {
                    maxlength = parseInt(maxlength)
                }
                if (req == 1 && ((val.length == 0 && valnospace.length == 0) || (($(this).attr('type') == 'checkbox' || $(this).attr('type') == 'radio') && $(this).closest('form').find('[name="' + $(this).attr('name') + '"]:checked').length == 0))) {
                    error.type.push('req')
                } else {
                    switch (rule) {
                        case 'email':
                            regExp = /^[a-zA-Zёа-яЁА-Я0-9_\.\-\+]{1,64}@[a-zA-Zёа-яЁА-ЯЁёäöüÄÖÜßèéû0-9][a-zA-Zёа-яЁА-ЯЁёäöüÄÖÜßèéû0-9\.\-]{0,253}\.[a-zA-Zёа-яЁА-Я]{2,10}$/gi;
                            if (val.length > 0 && !val.match(regExp)) {
                                error.type.push('email')
                            }
                            break;
                        case 'url':
                            regExp = /^((https?|ftp):\/\/)?[a-zA-Zёа-яЁА-ЯЁёäöüÄÖÜßèéûşç0-9][a-zA-Zёа-яЁА-ЯЁёäöüÄÖÜßèéûşç0-9_\.\-]{0,253}\.[a-zA-Zёа-яЁА-Я]{2,10}\/?$/gi;
                            if (val.length > 0) {
                                str = val.split('//');
                                if (str && str.length > 1) {
                                    str = str[1]
                                } else {
                                    str = str[0]
                                }
                                str = str.split('/');
                                if (str && str.length > 0 && str[0] > '') {
                                    str = str[0];
                                    if (!str.match(regExp)) {
                                        error.type.push('url')
                                    }
                                } else {
                                    if (!str || str[0] == '') {
                                        error.type.push('url')
                                    }
                                    str = ''
                                }
                            }
                            break;
                        case 'phone':
                            regExp = /^[0-9\(\)\-\+]+$/gi;
                            if (valnospace.length > 0 && !valnospace.match(regExp)) {
                                error.type.push('phone')
                            } else {
                                str = valnospace.replace(/[^0-9]+/g, '');
                                if (str.indexOf('000') == 1 || str.indexOf('111') == 1 || (str.indexOf('222') == 1 && str.substring(0, 1) != '5') || str.indexOf('333') == 1 || str.indexOf('444') == 1 || (str.indexOf('555') == 1 && str.substring(0, 1) != '0') || (str.indexOf('666') == 1 && str.substring(0, 1) != '0') || (str.indexOf('8888') == 1 && str.substring(0, 1) != '4')) {
                                    error.type.push('phone')
                                }
                            }
                            break;
                        case 'number':
                            regExp = /^[0-9]+$/gi;
                            if (valnospace.length > 0 && !valnospace.match(regExp)) {
                                error.type.push('number')
                            }
                            break;
                        case 'date':
                            regExp = /^[0-9]{1,4}[\-\.\/][0-9]{1,2}[\-\.\/][0-9]{1,4}$/gi;
                            if (valnospace.length > 0 && !valnospace.match(regExp)) {
                                error.type.push('date')
                            }
                            break;
                        case 'time':
                            regExp = /^[0-9]{2}[:\.][0-9]{2}$/gi;
                            if (valnospace.length > 0 && !valnospace.match(regExp)) {
                                error.type.push('time')
                            }
                            break;
                        case 'name':
                            regExp = /^([ЁёäöüÄÖÜßèéûҐґЄєІіЇїӐӑЙйК̆к̆Ӄ̆ӄ̆Ԛ̆ԛ̆Г̆г̆Ҕ̆ҕ̆ӖӗѢ̆ѣ̆ӁӂꚄ̆ꚅ̆ҊҋО̆о̆Ө̆ө̆Ꚍ̆ꚍ̆ЎўХ̆х̆Џ̆џ̆Ꚏ̆ꚏ̆Ꚇ̆ꚇ̆Ҽ̆ҽ̆Ш̆ш̆Ꚗ̆ꚗ̆Щ̆щ̆Ы̆ы̆Э̆э̆Ю̆ю̆Я̆я̆А́а́ЃѓД́д́Е́е́Ё́ёӘ́ә́З́з́И́и́І́і́Ї́ї́ЌќЛ́л́Н́н́О́о́Р́р́С́с́Т́т́У́у́Ӱ́ӱ́Ү́ү́Х́х́Ц́ц́Ы́ы́Э́э́Ӭ́ӭ́Ю́ю́Ю̈́ю̈́Я́я́Ѣ́ѣ́ҒғӺӻҒ̌ғ̌Ј̵ј̵ҞҟҜҝԞԟӨөҎҏҰұӾӿҸҹҌҍҢңҚқҒғӘәҺһІіҰұҮүӨөȺⱥꜺꜻƂƃɃƀȻȼꞒꞓƋƌĐđɆɇǤǥꞠꞡĦħƗɨƗ́ɨ́Ɨ̀ɨ̀Ɨ̂ɨ̂Ɨ̌ɨ̌Ɨ̃ɨ̃Ɨ̄ɨ̄Ɨ̈ɨ̈Ɨ̋ɨ̋Ɨ̏ɨ̏Ɨ̧ɨ̧Ɨ̧̀ɨ̧̀Ɨ̧̂ɨ̧̂Ɨ̧̌ɨ̧̌ᵼɈɉɟɟ̟ʄʄ̊ʄ̥K̵k̵ꝀꝁꝂꝃꝄꝅꞢꞣŁłł̓Ł̣ł̣ᴌȽƚⱠⱡꝈꝉƛƛ̓ꞤꞥꝊꝋØøǾǿØ̀ø̀Ø̂øØ̌ø̌Ø̄ø̄Ø̃ø̃Ø̨ø̨Ø᷎ø᷎ᴓⱣᵽꝐꝑꝖꝗꝘꝙɌɍꞦꞧꞨꞩẜẝŦŧȾⱦᵺꝤꝥꝦꝧɄʉɄ́ʉ́Ʉ̀ʉ̀Ʉ̂ʉ̂Ʉ̌ʉ̌Ʉ̄ʉ̄Ʉ̃ʉ̃Ʉ̃́ʉ̃́Ʉ̈ʉ̈ʉ̞ᵾU̸u̸ᵿꝞꝟw̸ɎɏƵƶA-Za-z\u0300-\u03FF\u0400-\u04FF\u0500-\u05FF\u0600-\u06FF\u3040-\u30FF\u0041-\u007A\u00C0-\u02B8\uFB1D-\uFB1F\uFB2A-\uFB4E]{1,})([ЁёäöüÄÖÜßèéûҐґЄєІіЇїӐӑЙйК̆к̆Ӄ̆ӄ̆Ԛ̆ԛ̆Г̆г̆Ҕ̆ҕ̆ӖӗѢ̆ѣ̆ӁӂꚄ̆ꚅ̆ҊҋО̆о̆Ө̆ө̆Ꚍ̆ꚍ̆ЎўХ̆х̆Џ̆џ̆Ꚏ̆ꚏ̆Ꚇ̆ꚇ̆Ҽ̆ҽ̆Ш̆ш̆Ꚗ̆ꚗ̆Щ̆щ̆Ы̆ы̆Э̆э̆Ю̆ю̆Я̆я̆А́а́ЃѓД́д́Е́е́Ё́ёӘ́ә́З́з́И́и́І́і́Ї́ї́ЌќЛ́л́Н́н́О́о́Р́р́С́с́Т́т́У́у́Ӱ́ӱ́Ү́ү́Х́х́Ц́ц́Ы́ы́Э́э́Ӭ́ӭ́Ю́ю́Ю̈́ю̈́Я́я́Ѣ́ѣ́ҒғӺӻҒ̌ғ̌Ј̵ј̵ҞҟҜҝԞԟӨөҎҏҰұӾӿҸҹҌҍҢңҚқҒғӘәҺһІіҰұҮүӨөȺⱥꜺꜻƂƃɃƀȻȼꞒꞓƋƌĐđɆɇǤǥꞠꞡĦħƗɨƗ́ɨ́Ɨ̀ɨ̀Ɨ̂ɨ̂Ɨ̌ɨ̌Ɨ̃ɨ̃Ɨ̄ɨ̄Ɨ̈ɨ̈Ɨ̋ɨ̋Ɨ̏ɨ̏Ɨ̧ɨ̧Ɨ̧̀ɨ̧̀Ɨ̧̂ɨ̧̂Ɨ̧̌ɨ̧̌ᵼɈɉɟɟ̟ʄʄ̊ʄ̥K̵k̵ꝀꝁꝂꝃꝄꝅꞢꞣŁłł̓Ł̣ł̣ᴌȽƚⱠⱡꝈꝉƛƛ̓ꞤꞥꝊꝋØøǾǿØ̀ø̀Ø̂øØ̌ø̌Ø̄ø̄Ø̃ø̃Ø̨ø̨Ø᷎ø᷎ᴓⱣᵽꝐꝑꝖꝗꝘꝙɌɍꞦꞧꞨꞩẜẝŦŧȾⱦᵺꝤꝥꝦꝧɄʉɄ́ʉ́Ʉ̀ʉ̀Ʉ̂ʉ̂Ʉ̌ʉ̌Ʉ̄ʉ̄Ʉ̃ʉ̃Ʉ̃́ʉ̃́Ʉ̈ʉ̈ʉ̞ᵾU̸u̸ᵿꝞꝟw̸ɎɏƵƶA-Za-z\u0041-\u007A\u00C0-\u02B8\u0300-\u03FF\u0400-\u04FF\u0500-\u05FF\u0600-\u06FF\u3040-\u30FF\uFB1D-\uFB1F\uFB2A-\uFB4E\-\'\s\.]{0,})$/gi;
                            if (val.length > 0 && !val.match(regExp)) {
                                error.type.push('name')
                            }
                            break;
                        case 'nameeng':
                            regExp = /^([A-Za-z\s]{1,}((\-)?[A-Za-z\.\s](\')?){0,})*$/i;
                            if (val.length > 0 && !val.match(regExp)) {
                                error.type.push('nameeng')
                            }
                            break;
                        case 'namerus':
                            regExp = /^([А-Яа-яЁё\s]{1,}((\-)?[А-Яа-яЁё\.\s](\')?){0,})*$/i;
                            if (val.length > 0 && !val.match(regExp)) {
                                error.type.push('namerus')
                            }
                            break;
                        case 'string':
                            regExp = /^[A-Za-zА-Яа-я0-9ЁёЁёäöüÄÖÜßèéûӐӑЙйК̆к̆Ӄ̆ӄ̆Ԛ̆ԛ̆Г̆г̆Ҕ̆ҕ̆ӖӗѢ̆ѣ̆ӁӂꚄ̆ꚅ̆ҊҋО̆о̆Ө̆ө̆Ꚍ̆ꚍ̆ЎўХ̆х̆Џ̆џ̆Ꚏ̆ꚏ̆Ꚇ̆ꚇ̆Ҽ̆ҽ̆Ш̆ш̆Ꚗ̆ꚗ̆Щ̆щ̆Ы̆ы̆Э̆э̆Ю̆ю̆Я̆я̆А́а́ЃѓД́д́Е́е́Ё́ёӘ́ә́З́з́И́и́І́і́Ї́ї́ЌќЛ́л́Н́н́О́о́Р́р́С́с́Т́т́У́у́Ӱ́ӱ́Ү́ү́Х́х́Ц́ц́Ы́ы́Э́э́Ӭ́ӭ́Ю́ю́Ю̈́ю̈́Я́я́Ѣ́ѣ́ҒғӺӻҒ̌ғ̌Ј̵ј̵ҞҟҜҝԞԟӨөҎҏҰұӾӿҸҹҌҍҢңҚқҒғӘәҺһІіҰұҮүӨөȺⱥꜺꜻƂƃɃƀȻȼꞒꞓƋƌĐđɆɇǤǥꞠꞡĦħƗɨƗ́ɨ́Ɨ̀ɨ̀Ɨ̂ɨ̂Ɨ̌ɨ̌Ɨ̃ɨ̃Ɨ̄ɨ̄Ɨ̈ɨ̈Ɨ̋ɨ̋Ɨ̏ɨ̏Ɨ̧ɨ̧Ɨ̧̀ɨ̧̀Ɨ̧̂ɨ̧̂Ɨ̧̌ɨ̧̌ᵼɈɉɟɟ̟ʄʄ̊ʄ̥K̵k̵ꝀꝁꝂꝃꝄꝅꞢꞣŁłł̓Ł̣ł̣ᴌȽƚⱠⱡꝈꝉƛƛ̓ꞤꞥꝊꝋØøǾǿØ̀ø̀Ø̂øØ̌ø̌Ø̄ø̄Ø̃ø̃Ø̨ø̨Ø᷎ø᷎ᴓⱣᵽꝐꝑꝖꝗꝘꝙɌɍꞦꞧꞨꞩẜẝŦŧȾⱦᵺꝤꝥꝦꝧɄʉɄ́ʉ́Ʉ̀ʉ̀Ʉ̂ʉ̂Ʉ̌ʉ̌Ʉ̄ʉ̄Ʉ̃ʉ̃Ʉ̃́ʉ̃́Ʉ̈ʉ̈ʉ̞ᵾU̸u̸ᵿꝞꝟw̸ɎɏƵƶ\u0041-\u007A\u00C0-\u02B8\u0300-\u03FF\u0400-\u04FF\u0500-\u05FF\u0600-\u06FF\u3040-\u30FF\uFB1D-\uFB1F\uFB2A-\uFB4E,\.:;\"\'\`\-\_\+\?\!\%\$\@\*\&\^\s]$/i;
                            if (val.length > 0 && !val.match(regExp)) {
                                error.type.push('string')
                            }
                            break;
                        case 'chosevalue':
                            var isOptionSelected = $(this).attr('data-option-selected') === 'true' ? !0 : !1;
                            if (!isOptionSelected) {
                                error.type.push('chosevalue')
                            }
                            break;
                        default:
                            break
                    }
                    if (minlength > 0 && val.length > 0 && val.length < minlength) {
                        error.type.push('minlength')
                    }
                    if (maxlength > 0 && val.length > 0 && val.length > maxlength) {
                        error.type.push('maxlength')
                    }
                }
                if (error.type && error.type.length > 0) {
                    arError[arError.length] = error
                }
            });
            if ($jform.attr('data-formcart') === 'y') {
                var minOrderSetted = typeof window.tcart_minorder != 'undefined' && window.tcart_minorder > 0;
                var minQuantitySetted = typeof window.tcart_mincntorder != 'undefined' && window.tcart_mincntorder > 0;
                if (minOrderSetted) {
                    if (window.tcart.prodamount >= window.tcart_minorder) {} else {
                        var error = {};
                        error.obj = $({});
                        error.type = [];
                        error.type.push('minorder');
                        arError.push(error)
                    }
                }
                if (minQuantitySetted) {
                    if (window.tcart.total >= window.tcart_mincntorder) {} else {
                        var error = {};
                        error.obj = $({});
                        error.type = [];
                        error.type.push('minquantity');
                        arError.push(error)
                    }
                }
            }
            if (isEmptyValue && arError.length == 0) {
                arError = [{
                    'obj': 'none',
                    'type': ['emptyfill']
                }]
            }
            return arError
        };
        window.tildaForm.hideErrors = function($jform) {
            $jform.find('.js-errorbox-all').hide();
            $jform.find('.js-rule-error').hide();
            $jform.find('.js-error-rule-all').html('');
            $jform.find('.js-successbox').hide();
            $jform.find('.js-error-control-box .t-input-error').html('');
            $jform.find('.js-error-control-box').removeClass('js-error-control-box');
            $jform.removeClass('js-send-form-error');
            $jform.removeClass('js-send-form-success');
            var $popupError = $('#tilda-popup-for-error');
            if ($popupError.length > 0) {
                $popupError.fadeOut()
            }
        };
        window.tildaForm.showErrorInPopup = function($jform, arErrors) {
            if (!arErrors || arErrors.length == 0) {
                return !1
            }
            var clsInputBoxSelector = $jform.data('inputbox');
            if (!clsInputBoxSelector) {
                clsInputBoxSelector = '.blockinput'
            }
            var arLang = window.tildaForm.arValidateErrors[window.tildaBrowserLang] || {};
            var $fieldgroup, isFieldErrorBoxExist, isShowCommonErrors, $errItem, sError = '',
                sCommonError = '';
            var $popupError = $('#tilda-popup-for-error');
            if ($popupError.length == 0) {
                $('body').append('<div id="tilda-popup-for-error" class="js-form-popup-errorbox tn-form__errorbox-popup" style="display: none;"> <div class="t-form__errorbox-text t-text t-text_xs"> error </div> <div class="tn-form__errorbox-close js-errorbox-close"> <div class="tn-form__errorbox-close-line tn-form__errorbox-close-line-left"></div> <div class="tn-form__errorbox-close-line tn-form__errorbox-close-line-right"></div> </div> </div>');
                $popupError = $('#tilda-popup-for-error');
                $('#tilda-popup-for-error').on('click', '.js-errorbox-close', function(e) {
                    e.preventDefault();
                    $('#tilda-popup-for-error').fadeOut();
                    return !1
                })
            }
            sCommonError = '';
            for (var i = 0; i < arErrors.length; i++) {
                if (!arErrors[i] || !arErrors[i].obj) {
                    continue
                }
                if (i == 0 && arErrors[i].obj == 'none') {
                    sCommonError = '<p class="t-form__errorbox-item">' + arLang.emptyfill + '</p>';
                    break
                }
                $fieldgroup = arErrors[i].obj.closest(clsInputBoxSelector).addClass('js-error-control-box')
                isFieldErrorBoxExist = 0;
                isShowCommonErrors = 1;
                if ($fieldgroup.find('.t-input-error').length > 0) {
                    isFieldErrorBoxExist = 1
                }
                for (j = 0; j < arErrors[i].type.length; j++) {
                    error = arErrors[i].type[j];
                    sError = '';
                    if (isShowCommonErrors == 1) {
                        $errItem = $jform.find('.js-rule-error-' + error);
                        if ($errItem.length > 0) {
                            if ($errItem.text() == '' && arLang[error] > '') {
                                if (sCommonError.indexOf(arLang[error]) == -1) {
                                    sCommonError = sCommonError + '<p class="t-form__errorbox-item">' + arLang[error] + '</p>'
                                }
                            } else {
                                sError = $errItem.eq(0).text();
                                if (sCommonError.indexOf(arLang[error]) == -1) {
                                    sCommonError = sCommonError + '<p class="t-form__errorbox-item">' + $errItem.eq(0).text() + '</p>'
                                }
                            }
                        } else {
                            if (arLang[error] > '') {
                                if (sCommonError.indexOf(arLang[error]) == -1) {
                                    sCommonError = sCommonError + '<p class="t-form__errorbox-item">' + arLang[error] + '</p>'
                                }
                            }
                        }
                    }
                    if (isFieldErrorBoxExist) {
                        if (sError == '') {
                            if (arLang[error + 'field'] > '') {
                                sError = arLang[error + 'field']
                            } else {
                                if (arLang[error] > '') {
                                    sError = arLang[error]
                                }
                            }
                        }
                        if (sError > '') {
                            $fieldgroup.find('.t-input-error').html(sError);
                            $fieldgroup.find('.t-input-error').fadeIn()
                        }
                    }
                }
            }
            if (sCommonError > '') {
                $popupError.find('.t-form__errorbox-text').html(sCommonError);
                $popupError.css('display', 'block').fadeIn();
                $popupError.find('.t-form__errorbox-item').fadeIn()
            }
            if (window.errorTimerID) {
                window.clearTimeout(window.errorTimerID)
            }
            window.errorTimerID = window.setTimeout(function() {
                $('#tilda-popup-for-error').fadeOut();
                $jform.find('.t-input-error').html('').fadeOut();
                window.errorTimerID = 0
            }, 10000);
            $jform.off('focus change', '.js-tilda-rule');
            $jform.on('focus change', '.js-tilda-rule', function() {
                $('#tilda-popup-for-error').fadeOut();
                $(this).closest('form').find('.t-input-error').html('').fadeOut();
                if (window.errorTimerID) {
                    window.clearTimeout(window.errorTimerID);
                    window.errorTimerID = 0
                }
            });
            $jform.trigger('tildaform:aftererror');
            return !0
        };
        window.tildaForm.showErrors = function($jform, arErrors) {
            if (!arErrors || arErrors.length == 0) {
                return !1
            }
            if ($jform.data('error-popup') == 'y') {
                return tildaForm.showErrorInPopup($jform, arErrors)
            }
            var clsInputBoxSelector = $jform.data('inputbox');
            if (!clsInputBoxSelector) {
                clsInputBoxSelector = '.blockinput'
            }
            var arLang = window.tildaForm.arValidateErrors[window.tildaBrowserLang] || {};
            var $fieldgroup, isFieldErrorBoxExist, isShowCommonErrors, $errItem, sError = '';
            for (var i = 0; i < arErrors.length; i++) {
                if (!arErrors[i] || !arErrors[i].obj) {
                    continue
                }
                if (i == 0 && arErrors[i].obj == 'none') {
                    $errItem = $jform.find('.js-rule-error-all');
                    $errItem.html(arLang.emptyfill);
                    $errItem.css('display', 'block').show();
                    break
                }
                $fieldgroup = arErrors[i].obj.closest(clsInputBoxSelector).addClass('js-error-control-box')
                isFieldErrorBoxExist = 0;
                isShowCommonErrors = 1;
                if ($fieldgroup.find('.t-input-error').length > 0) {
                    isFieldErrorBoxExist = 1
                }
                for (j = 0; j < arErrors[i].type.length; j++) {
                    error = arErrors[i].type[j];
                    sError = '';
                    if (isShowCommonErrors == 1) {
                        $errItem = $jform.find('.js-rule-error-' + error);
                        if (($errItem.attr('data-rule-filled'))) {
                            $errItem.css('display', 'block').show()
                        } else if ($errItem.length > 0) {
                            if ($errItem.text() == '' && arLang[error] > '') {
                                $errItem.html(arLang[error])
                            } else {
                                sError = $errItem.eq(0).text()
                            }
                            $errItem.css('display', 'block').show()
                        } else {
                            if (arLang[error] > '') {
                                $errItem = $jform.find('.js-rule-error-all');
                                if ($errItem && $errItem.length > 0) {
                                    $errItem.html(arLang[error]);
                                    $errItem.css('display', 'block').show()
                                }
                            }
                        }
                    }
                    if (isFieldErrorBoxExist) {
                        if (sError == '') {
                            if (arLang[error + 'field'] > '') {
                                sError = arLang[error + 'field']
                            } else {
                                if (arLang[error] > '') {
                                    sError = arLang[error]
                                }
                            }
                        }
                        if (sError > '') {
                            $fieldgroup.find('.t-input-error').html(sError)
                        }
                    }
                }
            }
            $jform.find('.js-errorbox-all').css('display', 'block').show();
            $jform.trigger('tildaform:aftererror');
            return !0
        };
        checkVerifyTildaCaptcha = function(event) {
            if (event.origin.indexOf(window.tildaForm.endpoint) != -1) {
                if (event.data == 'closeiframe') {
                    $('#tildaformcaptchabox').remove();
                    $('#js-tildaspec-captcha').remove();
                    return
                }
                var capthakey = event.data;
                var $elem = $('#js-tildaspec-captcha');
                if ($elem && $elem.length > 0) {
                    $elem.val(capthakey);
                    $('#tildaformcaptchabox').remove();
                    $elem.closest('form').trigger('submit')
                }
                return
            } else {
                return
            }
        };
        window.tildaForm.addTildaCaptcha = function($jform, formskey) {
            $('#tildaformcaptchabox').remove();
            $('#js-tildaspec-captcha').remove();
            $jform.append('<input type="hidden" name="tildaspec-tildacaptcha" id="js-tildaspec-captcha">');
            var randomkey;
            try {
                randomkey = '' + new Date().getTime() + '=' + parseInt(Math.random() * 8)
            } catch (e) {
                randomkey = 'rnd=' + parseInt(Math.random() * 8)
            }
            $('body').append('<div id="tildaformcaptchabox" style="z-index:10000000;position:fixed; text-align: center; vertical-align: middle; top: 0px; left:0px; bottom: 0px; right: 0px; background: rgba(255,255,255,0.97);"><iframe id="captchaIframeBox" src="//' + window.tildaForm.endpoint + '/procces/captcha/?tildaspec-formid=' + $jform.attr('id') + '&tildaspec-formskey=' + formskey + '&' + randomkey + '" frameborder="0" width="100%" height="100%"></iframe></div>');
            window.removeEventListener('message', checkVerifyTildaCaptcha);
            window.addEventListener('message', checkVerifyTildaCaptcha)
        };
        window.tildaForm.addPaymentInfoToForm = function($jform) {
            $jform.find('.js-tilda-payment').remove();
            var product, i, j, html = '',
                proddiscount = 0;
            window.tildaForm.tildapayment = {};
            window.tildaForm.arProductsForStat = []
            window.tildaForm.orderIdForStat = '';
            window.tildaForm.amountForStat = 0;
            window.tildaForm.currencyForStat = '';
            var currencyCode = $('#allrecords').data('tilda-currency') || $('.t706').data('project-currency-code') || '';
            if (currencyCode) {
                window.tildaForm.currencyForStat = currencyCode;
                window.tildaForm.tildapayment.currency = currencyCode
            } else {
                if (window.tcart.currency && window.tcart.currency > '') {
                    window.tildaForm.currencyForStat = window.tcart.currency;
                    window.tildaForm.tildapayment.currency = window.tcart.currency
                }
            }
            if (!window.tcart.delivery && $('.t-radio_delivery:checked').length && $('.t-radio_delivery:checked').data('delivery-price') > 0) {
                try {
                    window.tildaForm.tildapayment = !1;
                    window.location.reload();
                    return !1
                } catch (e) {}
            }
            window.tildaForm.amountForStat = window.tcart.amount;
            window.tildaForm.tildapayment.amount = window.tcart.amount;
            if (window.tcart.system && window.tcart.system > '') {
                window.tildaForm.tildapayment.system = window.tcart.system
            } else {
                window.tildaForm.tildapayment.system = 'auto'
            }
            if (window.tcart.promocode && window.tcart.promocode.promocode > '') {
                window.tildaForm.tildapayment.promocode = window.tcart.promocode.promocode;
                if (window.tcart.prodamount_discountsum && parseFloat(window.tcart.prodamount_discountsum) > 0) {
                    window.tildaForm.tildapayment.discount = window.tcart.prodamount_discountsum;
                    proddiscount = window.tcart.prodamount_discountsum
                } else {
                    if (window.tcart.amount_discountsum && parseFloat(window.tcart.amount_discountsum) > 0) {
                        proddiscount = window.tcart.amount_discountsum;
                        window.tildaForm.tildapayment.discount = window.tcart.amount_discountsum
                    }
                }
                if (window.tcart.prodamount_withdiscount && parseFloat(window.tcart.prodamount_withdiscount) > 0) {
                    window.tildaForm.tildapayment.prodamount_withdiscount = window.tcart.prodamount_withdiscount
                }
                if (window.tcart.amount_withoutdiscount && parseFloat(window.tcart.amount_withoutdiscount) > 0) {
                    window.tildaForm.tildapayment.amount_withoutdiscount = window.tcart.amount_withoutdiscount
                }
            }
            if (window.tcart.prodamount && parseFloat(window.tcart.prodamount) > 0) {
                window.tildaForm.tildapayment.prodamount = window.tcart.prodamount
            }
            var dNow = new Date();
            var offsetFrom_UTC_to_Local = dNow.getTimezoneOffset();
            window.tildaForm.tildapayment.timezoneoffset = offsetFrom_UTC_to_Local;
            var arProduct, optionlabel, iProductsCount = 0;
            if (window.tcart.products && window.tcart.products.length > 0) {
                iProductsCount = window.tcart.products.length
            }
            window.tildaForm.tildapayment.products = [];
            for (i = 0; i < iProductsCount; i = i + 1) {
                product = window.tcart.products[i];
                arProduct = {};
                optionlabel = '';
                window.tildaForm.tildapayment.products[i] = {};
                for (j in product) {
                    if (typeof(product[j]) != 'function') {
                        if (j == 'options') {
                            window.tildaForm.tildapayment.products[i][j] = {};
                            for (var o in product[j]) {
                                if (typeof window.tildaForm.tildapayment.products[i][j][o] == 'undefined') {
                                    window.tildaForm.tildapayment.products[i][j][o] = {}
                                }
                                if (product[j][o].option) {
                                    window.tildaForm.tildapayment.products[i][j][o].option = product[j][o].option
                                }
                                if (product[j][o].price && product[j][o].price > 0) {
                                    window.tildaForm.tildapayment.products[i][j][o].price = product[j][o].price
                                }
                                if (product[j][o].variant) {
                                    window.tildaForm.tildapayment.products[i][j][o].variant = product[j][o].variant
                                }
                                if (product[j][o].option && product[j][o].variant) {
                                    if (optionlabel > '') {
                                        optionlabel = optionlabel + ', '
                                    }
                                    optionlabel = optionlabel + product[j][o].option + ':' + product[j][o].variant
                                }
                            }
                        } else {
                            window.tildaForm.tildapayment.products[i][j] = product[j]
                        }
                    }
                }
                if (product.sku) {
                    arProduct.id = product.sku
                } else {
                    if (product.uid) {
                        arProduct.id = product.uid
                    }
                }
                arProduct.name = product.name;
                if (product.price) {
                    arProduct.price = product.price;
                    arProduct.quantity = parseInt(product.amount / product.price)
                } else {
                    if (product.quantity && product.quantity > 1) {
                        arProduct.price = product.amount / product.quantity;
                        arProduct.quantity = product.quantity
                    } else {
                        arProduct.price = product.amount
                        arProduct.quantity = 1
                    }
                }
                arProduct.name = product.name;
                if (optionlabel > '') {
                    arProduct.name = arProduct.name + '(' + optionlabel + ')'
                }
                if (product.sku) {
                    arProduct.sku = product.sku
                }
                if (product.uid) {
                    arProduct.uid = product.uid
                }
                window.tildaForm.arProductsForStat.push(arProduct)
            }
            if (window.tcart.delivery && window.tcart.delivery.name) {
                window.tildaForm.tildapayment.delivery = {
                    name: window.tcart.delivery.name
                };
                if (window.tcart.delivery && window.tcart.delivery.price) {
                    pricedelivery = window.tcart.delivery.price;
                    window.tildaForm.tildapayment.delivery.price = window.tcart.delivery.price;
                    if (window.tcart.prodamount > 0 && typeof window.tcart.delivery.freedl != 'undefined' && window.tcart.delivery.freedl > 0) {
                        window.tildaForm.tildapayment.delivery.freedl = window.tcart.delivery.freedl;
                        if ((window.tcart.prodamount - proddiscount) >= window.tcart.delivery.freedl) {
                            pricedelivery = 0
                        }
                    }
                    arProduct = {
                        name: window.tcart.delivery.name,
                        price: pricedelivery,
                        quantity: 1,
                        id: 'delivery'
                    }
                    window.tildaForm.arProductsForStat.push(arProduct)
                }
            }
            try {
                var keysForTildapayment = ['city', 'street', 'pickup-name', 'pickup-address', 'pickup-id', 'house', 'entrance', 'floor', 'aptoffice', 'phone', 'entrancecode', 'comment', 'service-id', 'hash', 'postalcode', 'country', 'userinitials', 'onelineaddress'];
                keysForTildapayment.forEach(function(keyForTildapayment) {
                    if (window.tcart.delivery && window.tcart.delivery[keyForTildapayment]) {
                        window.tildaForm.tildapayment.delivery[keyForTildapayment] = window.tcart.delivery[keyForTildapayment]
                    }
                })
            } catch (e) {
                console.log(e)
            }
            $jform.append(html)
        }
        window.tildaForm.clearTCart = function($jform) {
            if ($jform.data('formcart') == 'y') {
                window.tcart = {
                    amount: 0,
                    currency: '',
                    system: '',
                    products: []
                };
                window.tcart.system = 'none';
                if (typeof localStorage === 'object') {
                    try {
                        localStorage.removeItem("tcart")
                    } catch (e) {
                        console.log('Your web browser does not support localStorage.')
                    }
                }
                try {
                    delete window.tcart;
                    tcart__loadLocalObj()
                } catch (e) {}
                window.tcart_success = 'yes'
            }
        }
        window.tildaForm.payment = function($jform, arNext) {
            var html = '';
            if ($jform.data('formpaymentoff') == 'y') {
                tildaForm.clearTCart($jform);
                return
            }
            if ($jform.find('.js-successbox').length > 0) {
                if ($jform.find('.js-successbox').text() > '') {
                    $jform.data('successmessage', $jform.find('.js-successbox').text())
                }
                var arMessage = window.tildaForm.arMessages[window.tildaBrowserLang] || {};
                if (arMessage.successorder) {
                    $jform.find('.js-successbox').html(arMessage.successorder)
                }
                $jform.find('.js-successbox').show()
            }
            $jform.addClass('js-send-form-success');
            if (arNext.type == 'link') {
                tildaForm.clearTCart($jform);
                if (arNext.message && arNext.message > '' && $jform.find('.js-successbox').length > 0) {
                    $jform.find('.js-successbox').html(arNext.message);
                    $jform.find('.js-successbox').show()
                }
                window.location.href = arNext.value;
                return !0
            } else {
                if (arNext.type == 'form') {
                    tildaForm.clearTCart($jform);
                    $('#js-tilda-payment-formid').remove();
                    var key = '',
                        val = '';
                    html = '<form id="js-tilda-payment-formid" action="' + arNext.value.action + '" method="post"  style="position:absolue;opacity:0;width: 1px; height: 1px; left: -5000px;">';
                    arNext.value.action = '';
                    for (key in arNext.value) {
                        val = arNext.value[key];
                        if (typeof(val) != 'function' && val > '') {
                            html += "<input type='hidden' name='" + key + "' value='" + val + "' >"
                        }
                    }
                    html += '</form>';
                    $('body').append(html);
                    $('#js-tilda-payment-formid').submit()
                } else {
                    if (arNext.type == 'function') {
                        var arArgs = arNext.value.args;
                        if (arNext.value.functioncode) {
                            tildaForm.paysystemRun(arNext.value.script, arNext.value.sysname, $jform, arNext.value.functioncode, arArgs)
                        } else {
                            eval(arNext.value.name + '($jform, arArgs);')
                        }
                        return !1
                    } else {
                        tildaForm.clearTCart($jform);
                        if (arNext.type == 'text' && arNext.message && arNext.message > '' && $jform.find('.js-successbox').length > 0) {
                            $jform.find('.js-successbox').html(arNext.message);
                            $jform.find('.js-successbox').show()
                        }
                    }
                }
            }
        };
        window.tildaForm.paysystemScriptLoad = function(src, sysname) {
            if (!sysname || !src || src.substring(0, 4) != 'http') {
                console.log('Wrong script parameters.');
                return !1
            }
            if (!window.scriptSysPayment) {
                window.scriptSysPayment = {}
            }
            if (!window.scriptSysPayment[sysname] || window.scriptSysPayment[sysname] !== !0) {
                var script = document.createElement("script");
                script.type = "text/javascript";
                script.src = src;
                document.body.appendChild(script);
                window.scriptSysPayment[sysname] = !0
            }
        };
        window.tildaForm.paysystemRun = function(script, sysname, $jform, functioncode, arArgs) {
            if (!window.scriptSysPayment) {
                window.scriptSysPayment = {}
            }
            if (!window.scriptSysPayment[sysname] || window.scriptSysPayment[sysname] !== !0) {
                window.tildaForm.paysystemScriptLoad(script, sysname);
                window.setTimeout(function() {
                    window.tildaForm.paysystemRun(script, sysname, $jform, functioncode, arArgs)
                }, 200);
                return !1
            }
            eval(functioncode)
        };
        window.tildaForm.paysystemSuccess = function($jform, arArgs) {
            window.tildaForm.clearTCart($jform);
            var virtPage = '/tilda/' + $jform.attr('id') + '/payment/';
            var virtTitle = 'Pay order in form ' + $jform.attr('id');
            var virtPrice = arArgs.amount;
            var virtProduct = arArgs.description;
            if (window.Tilda && typeof Tilda.sendEventToStatistics == 'function') {
                var currency = $('#allrecords').data('tilda-currency') || $('.t706').data('project-currency-code');
                if (!currency) {
                    $('#allrecords').data('tilda-currency', arArgs.currency)
                }
                Tilda.sendEventToStatistics(virtPage, virtTitle, virtProduct, virtPrice)
            }
            if (arArgs.successurl > '') {
                window.setTimeout(function() {
                    window.location.href = arArgs.successurl
                }, 300)
            }
            if ($jform.data('successmessage') > '') {
                $jform.find('.js-successbox').html($jform.data('successmessage'))
            } else {
                $jform.find('.js-successbox').html('')
            }
            $jform.data('successmessage', '');
            var successcallback = $jform.data('success-callback');
            window.tildaForm.successEnd($jform, arArgs.successurl, successcallback);
            $jform.trigger('tildaform:aftersuccess')
        };
        window.tildaForm.stripeLoad = function() {
            if (window.stripeapiiscalled !== !0) {
                var script = document.createElement("script");
                script.type = "text/javascript";
                script.src = "https://checkout.stripe.com/checkout.js";
                document.body.appendChild(script);
                window.stripeapiiscalled = !0
            }
        };
        window.tildaForm.stripePay = function($jform, arArgs) {
            if (window.stripeapiiscalled !== !0) {
                window.tildaForm.stripeLoad();
                window.setTimeout(function() {
                    window.tildaForm.stripePay($jform, arArgs)
                }, 200);
                return !1
            }
            var companyname = arArgs.companyname;
            var companylogo = arArgs.companylogo;
            if (!companyname) {
                companyname = window.location.host
            }
            if (!window.stripehandler) {
                if (typeof window.StripeCheckout != 'object') {
                    window.setTimeout(function() {
                        window.tildaForm.stripePay($jform, arArgs)
                    }, 200);
                    return !1
                }
                var arStripeInit = {
                    key: arArgs.accountid,
                    image: companylogo,
                    name: companyname,
                    locale: 'auto'
                };
                if (arArgs.zipCode && arArgs.zipCode == 1) {
                    arStripeInit.zipCode = !0
                }
                if (arArgs.billingAddress && arArgs.billingAddress == 1) {
                    arStripeInit.billingAddress = !0
                }
                if (arArgs.shipping && arArgs.shipping == 1) {
                    arStripeInit.shippingAddress = !0
                }
                window.stripehandler = window.StripeCheckout.configure(arStripeInit);
                $(window).on('popstate', function() {
                    window.stripehandler.close()
                })
            }
            window.tildaForm.orderIdForStat = arArgs.invoiceid;
            var multiple = 100;
            try {
                if (arArgs.multiple && arArgs.multiple > 0) {
                    multiple = parseInt(arArgs.multiple)
                }
            } catch (e) {}
            window.stripehandler.open({
                name: companyname,
                image: companylogo,
                description: arArgs.description,
                amount: parseInt((parseFloat(arArgs.amount) * multiple).toFixed()),
                currency: arArgs.currency,
                shippingAddress: arArgs.shipping == '1' ? !0 : !1,
                email: arArgs.email > '' ? arArgs.email : '',
                token: function(token, args) {
                    if (token && token.id) {
                        $.ajax({
                            type: "POST",
                            url: 'https://' + window.tildaForm.endpoint + '/payment/stripe/',
                            data: {
                                projectid: arArgs.projectid,
                                invoiceid: arArgs.invoiceid,
                                token: token.id,
                                email: token.email,
                                currency: arArgs.currency,
                                amount: parseInt((parseFloat(arArgs.amount) * multiple).toFixed())
                            },
                            dataType: "json",
                            xhrFields: {
                                withCredentials: !1
                            },
                            success: function(json) {
                                window.tildaForm.clearTCart($jform);
                                var virtPage = '/tilda/' + $jform.attr('id') + '/payment/';
                                var virtTitle = 'Pay order in form ' + $jform.attr('id');
                                var virtPrice = arArgs.amount;
                                var virtProduct = arArgs.description;
                                if (window.Tilda && typeof Tilda.sendEventToStatistics == 'function') {
                                    var currency = $('#allrecords').data('tilda-currency') || $('.t706').data('project-currency-code');
                                    if (!currency) {
                                        $('#allrecords').data('tilda-currency', arArgs.currency)
                                    }
                                    Tilda.sendEventToStatistics(virtPage, virtTitle, virtProduct, virtPrice)
                                }
                                if (arArgs.successurl > '') {
                                    window.setTimeout(function() {
                                        window.location.href = arArgs.successurl
                                    }, 300)
                                }
                                if ($jform.data('successmessage') > '') {
                                    $jform.find('.js-successbox').html($jform.data('successmessage'))
                                } else {
                                    $jform.find('.js-successbox').html('')
                                }
                                $jform.data('successmessage', '');
                                var successcallback = $jform.data('success-callback');
                                window.tildaForm.successEnd($jform, arArgs.successurl, successcallback);
                                $jform.trigger('tildaform:aftersuccess')
                            },
                            fail: function() {},
                            timeout: 15 * 1000
                        })
                    }
                }
            })
        };
        window.tildaForm.cloudpaymentLoad = function() {
            if (window.cloudpaymentsapiiscalled !== !0) {
                var script = document.createElement("script");
                script.type = "text/javascript";
                script.src = "https://widget.cloudpayments.ru/bundles/cloudpayments";
                document.body.appendChild(script);
                window.cloudpaymentsapiiscalled = !0
            }
        };
        window.tildaForm.cloudpaymentPay = function($jform, arArgs) {
            if (window.cloudpaymentsapiiscalled !== !0) {
                window.tildaForm.cloudpaymentLoad();
                window.setTimeout(function() {
                    window.tildaForm.cloudpaymentPay($jform, arArgs)
                }, 200);
                return !1
            }
            var currency = arArgs.currency;
            var language = arArgs.language;
            var initCP = {};
            if (!language) {
                if (currency == 'RUB' || currency == 'BYR' || currency == 'BYN' || currency == 'RUR') {
                    language = 'ru-RU'
                } else {
                    if (currency == 'UAH') {
                        language = 'uk'
                    } else {
                        language = 'en-US'
                    }
                }
            }
            if (!window.cloudpaymentshandler) {
                if (typeof window.cp != 'object') {
                    window.setTimeout(function() {
                        window.tildaForm.cloudpaymentPay($jform, arArgs)
                    }, 200);
                    return !1
                }
                initCP = {
                    language: language
                };
                if (arArgs.applePaySupport && arArgs.applePaySupport == 'off') {
                    initCP.applePaySupport = !1
                }
                if (arArgs.googlePaySupport && arArgs.googlePaySupport == 'off') {
                    initCP.googlePaySupport = !1
                }
                window.cloudpaymentshandler = new cp.CloudPayments(initCP)
            }
            var arData = {};
            arData.projectid = arArgs.projectid;
            if (arArgs.cloudPayments && (arArgs.cloudPayments.recurrent || arArgs.cloudPayments.customerReceipt)) {
                arData.cloudPayments = arArgs.cloudPayments
            }
            var $jpopup = $jform.closest('.t-popup_show');
            if (!$jpopup || $jpopup.length == 0) {
                $jpopup = $jform.closest('.t706__cartwin_showed')
            }
            $jpopup.data('old-style', $jpopup.attr('style'));
            $jpopup.attr('style', 'z-index:100');
            window.tildaForm.orderIdForStat = arArgs.invoiceId;
            if (!arArgs.skin) {
                arArgs.skin = 'classic'
            }
            window.cloudpaymentshandler.charge({
                publicId: arArgs.publicId,
                description: arArgs.description,
                amount: parseFloat(arArgs.amount),
                currency: currency,
                accountId: arArgs.accountId,
                invoiceId: arArgs.invoiceId,
                requireEmail: arArgs.requireEmail == !0 ? !0 : !1,
                email: arArgs.email,
                skin: arArgs.skin,
                data: arData
            }, function(options) {
                window.cloudpaymentshandler = !1;
                $jpopup.attr('style', $jpopup.data('old-style'));
                var virtPage = '/tilda/' + $jform.attr('id') + '/payment/';
                var virtTitle = 'Pay order in form ' + $jform.attr('id');
                var virtPrice = arArgs.amount;
                var virtProduct = arArgs.description;
                $('#allrecords').data('tilda-currency', currency);
                if (window.Tilda && typeof Tilda.sendEventToStatistics == 'function') {
                    Tilda.sendEventToStatistics(virtPage, virtTitle, virtProduct, virtPrice)
                }
                window.tildaForm.clearTCart($jform);
                if (arArgs.successurl > '') {
                    window.setTimeout(function() {
                        window.location.href = arArgs.successurl
                    }, 300)
                }
                if ($jform.data('successmessage') > '') {
                    $jform.find('.js-successbox').html($jform.data('successmessage'))
                } else {
                    $jform.find('.js-successbox').html('')
                }
                $jform.data('successmessage', '');
                var successcallback = $jform.data('success-callback');
                window.tildaForm.successEnd($jform, arArgs.successurl, successcallback);
                $jform.trigger('tildaform:aftersuccess')
            }, function(reason, options) {
                $jpopup.attr('style', $jpopup.data('old-style'));
                $jform.find('.js-successbox').hide();
                if ($jform.data('successmessage') > '') {
                    $jform.find('.js-successbox').html($jform.data('successmessage'))
                } else {
                    $jform.find('.js-successbox').html('')
                }
                $jform.data('successmessage', '');
                window.cloudpaymentshandler = !1;
                if (arArgs.failureurl > '') {
                    window.location.href = arArgs.failureurl
                } else {
                    $jpopup.find('.t706__cartwin-products').show();
                    $jpopup.find('.t706__cartwin-prodamount-wrap').show();
                    $jpopup.find('.t706__form-bottom-text').show();
                    $jform.find('.t-form__inputsbox').show();
                    try {
                        tcart__lockScroll()
                    } catch (e) {}
                }
            });
            return !1
        };
        window.tildaForm.sendStatAndShowMessage = function($jform, arArgs, sendStat) {
            if (sendStat) {
                var virtPage = '/tilda/' + $jform.attr('id') + '/payment/';
                var virtTitle = 'Pay order in form ' + $jform.attr('id');
                var virtPrice = arArgs.amount;
                var virtProduct = arArgs.description;
                if (window.Tilda && typeof Tilda.sendEventToStatistics == 'function') {
                    var currency = $('#allrecords').data('tilda-currency') || $('.t706').data('project-currency-code');
                    if (!currency) {
                        $('#allrecords').data('tilda-currency', arArgs.currency)
                    }
                    Tilda.sendEventToStatistics(virtPage, virtTitle, virtProduct, virtPrice)
                }
            }
            if ($jform.find('.js-successbox').length > 0) {
                if ($jform.data('success-popup') == 'y') {
                    $jform.find('.js-successbox').hide()
                }
                if (arArgs.successmessage && arArgs.successmessage > '') {
                    $jform.find('.js-successbox').html(arArgs.successmessage)
                } else {
                    if ($jform.data('successmessage') > '') {
                        $jform.find('.js-successbox').html($jform.data('successmessage'))
                    } else {
                        var arMessage = window.tildaForm.arMessages[window.tildaBrowserLang] || {};
                        if (arMessage.success) {
                            $jform.find('.js-successbox').html(arMessage.success)
                        } else {
                            $jform.find('.js-successbox').html('')
                        }
                    }
                }
                $jform.data('successmessage', '');
                if ($jform.data('success-popup') == 'y') {
                    window.tildaForm.showSuccessPopup($jform.find('.js-successbox').html())
                } else {
                    $jform.find('.js-successbox').show()
                }
            }
            $jform.addClass('js-send-form-success');
            window.tildaForm.clearTCart($jform);
            if (arArgs.successurl > '') {
                window.setTimeout(function() {
                    window.location.href = arArgs.successurl
                }, 300)
            }
            var successcallback = $jform.data('success-callback');
            if (successcallback && successcallback.length > 0) {
                eval(successcallback + '($jform)')
            }
            $jform.find('input[type=text]:visible').val('');
            $jform.find('textarea:visible').html('');
            $jform.find('textarea:visible').val('');
            $jform.data('tildaformresult', {
                tranid: "0",
                orderid: "0"
            });
            $jform.trigger('tildaform:aftersuccess')
        };
        window.tildaForm.banktransferPay = function($jform, arArgs) {
            if (arArgs && arArgs.condition == 'fast') {
                window.tildaForm.sendStatAndShowMessage($jform, arArgs, !0)
            } else {
                if (arArgs && arArgs.html > '') {
                    $('#allrecords').append(arArgs.html);
                    $('.t-banktransfer .t-popup__close').off('click');
                    $('.t-banktransfer .t-popup__close').click(function() {
                        $('body').removeClass('t-body_popupshowed');
                        $('.t-banktransfer').remove();
                        try {
                            if (typeof tcart__closeCart == 'function') {
                                tcart__closeCart()
                            }
                        } catch (e) {}
                        return !1
                    });
                    $('body').addClass('t-body_popupshowed');
                    var $jbankform = $('#formbanktransfer'),
                        arErrors;
                    if ($jbankform.length > 0) {
                        $jbankform.off('submit');
                        $jbankform.find('.t-submit').off('click');
                        $jbankform.find('.t-submit').off('dblclick');
                        $jbankform.submit(function(e) {
                            e.preventDefault();
                            arErrors = window.tildaForm.validate($jbankform);
                            if (arErrors && arErrors.length > 0) {
                                window.tildaForm.showErrors($jbankform, arErrors);
                                return !1
                            }
                            $.ajax({
                                type: "POST",
                                url: 'https://' + window.tildaForm.endpoint + '/payment/banktransfer/',
                                data: $jbankform.serialize(),
                                dataType: "json",
                                xhrFields: {
                                    withCredentials: !1
                                },
                                success: function(json) {
                                    $('body').removeClass('t-body_popupshowed');
                                    $jbankform.closest('.t-banktransfer').remove();
                                    if (!json) {
                                        json = {
                                            error: 'Unknown error. Please reload page and try again later.'
                                        }
                                    }
                                    if (json && json.error) {
                                        alert(json.error);
                                        return !1
                                    }
                                    window.tildaForm.sendStatAndShowMessage($jform, arArgs, !0)
                                },
                                error: function(data) {
                                    $('body').removeClass('t-body_popupshowed');
                                    $jbankform.remove();
                                    alert(data)
                                },
                                timeout: 15 * 1000
                            })
                        })
                    }
                } else {
                    window.tildaForm.sendStatAndShowMessage($jform, arArgs, !0)
                }
            }
        };
        window.tildaForm.closeSuccessPopup = function() {
            var $popup = $('#tildaformsuccesspopup');
            if ($popup.length > 0) {
                $('body').removeClass('t-body_success-popup-showed');
                if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream) {
                    window.tildaForm.unlockBodyScroll()
                }
                $popup.fadeOut('fast')
            }
        };
        window.tildaForm.lockBodyScroll = function() {
            var body = $("body");
            if (!body.hasClass('t-body_scroll-locked')) {
                var bodyScrollTop = (typeof window.pageYOffset !== 'undefined') ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
                body.addClass('t-body_scroll-locked');
                body.css("top", "-" + bodyScrollTop + "px");
                body.attr("data-popup-scrolltop", bodyScrollTop)
            }
        };
        window.tildaForm.unlockBodyScroll = function() {
            var body = $("body");
            if (body.hasClass('t-body_scroll-locked')) {
                var bodyScrollTop = $("body").attr("data-popup-scrolltop");
                body.removeClass('t-body_scroll-locked');
                body.css("top", "");
                body.removeAttr("data-popup-scrolltop")
                window.scrollTo(0, bodyScrollTop)
            }
        };
        window.tildaForm.showSuccessPopup = function(message) {
            var html = '';
            var $popup = $('#tildaformsuccesspopup');
            if ($popup.length == 0) {
                html = '<style media="screen"> .t-form-success-popup { display: none; position: fixed; background-color: rgba(0,0,0,.8); top: 0px; left: 0px; width: 100%; height: 100%; z-index: 10000; overflow-y: auto; cursor: pointer; } .t-body_success-popup-showed { height: 100vh; min-height: 100vh; overflow: hidden; } .t-form-success-popup__window { width: 100%; max-width: 400px; position: absolute; top: 50%; -webkit-transform: translateY(-50%); transform: translateY(-50%); left: 0px; right: 0px; margin: 0 auto; padding: 20px; box-sizing: border-box; } .t-form-success-popup__wrapper { background-color: #fff; padding: 40px 40px 50px; box-sizing: border-box; border-radius: 5px; text-align: center; position: relative; cursor: default; } .t-form-success-popup__text { padding-top: 20px; } .t-form-success-popup__close-icon { position: absolute; top: 14px; right: 14px; cursor: pointer; } @media screen and (max-width: 480px) { .t-form-success-popup__text { padding-top: 10px; } .t-form-success-popup__wrapper { padding-left: 20px; padding-right: 20px; } } </style>';
                html += '<div class="t-form-success-popup" style="display:none;" id="tildaformsuccesspopup"> <div class="t-form-success-popup__window"> <div class="t-form-success-popup__wrapper"> <svg class="t-form-success-popup__close-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="t657__icon-close" viewBox="0 0 23 23"> <g fill-rule="evenodd"> <path d="M0 1.41L1.4 0l21.22 21.21-1.41 1.42z"/> <path d="M21.21 0l1.42 1.4L1.4 22.63 0 21.21z"/> </g> </svg> <svg width="50" height="50" fill="#62C584"> <path d="M25.1 49.28A24.64 24.64 0 0 1 .5 24.68 24.64 24.64 0 0 1 25.1.07a24.64 24.64 0 0 1 24.6 24.6 24.64 24.64 0 0 1-24.6 24.61zm0-47.45A22.87 22.87 0 0 0 2.26 24.68 22.87 22.87 0 0 0 25.1 47.52a22.87 22.87 0 0 0 22.84-22.84A22.87 22.87 0 0 0 25.1 1.83z"/> <path d="M22.84 30.53l-4.44-4.45a.88.88 0 1 1 1.24-1.24l3.2 3.2 8.89-8.9a.88.88 0 1 1 1.25 1.26L22.84 30.53z"/> </svg> <div class="t-form-success-popup__text t-descr t-descr_sm" id="tildaformsuccesspopuptext"> Thank You! </div> </div> </div> </div>';
                $('body').append(html);
                $popup = $('#tildaformsuccesspopup');
                $popup.click(function(e) {
                    if (e.target == this) {
                        window.tildaForm.closeSuccessPopup()
                    }
                });
                $popup.find('.t-form-success-popup__close-icon').click(function(e) {
                    window.tildaForm.closeSuccessPopup()
                });
                $(document).keydown(function(e) {
                    if (e.keyCode == 27) {
                        window.tildaForm.closeSuccessPopup()
                    }
                })
            }
            $('#tildaformsuccesspopuptext').html(message);
            $popup.fadeIn('fast');
            $('body').addClass('t-body_success-popup-showed');
            if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream) {
                setTimeout(function() {
                    window.tildaForm.lockBodyScroll()
                }, 500)
            }
        };
        window.tildaForm.successEnd = function($jform, successurl, successcallback) {
            if ($jform.find('.js-successbox').length > 0) {
                if ($jform.find('.js-successbox').text() == '') {
                    var arMessage = window.tildaForm.arMessages[window.tildaBrowserLang] || {};
                    if (arMessage.success) {
                        $jform.find('.js-successbox').html(arMessage.success)
                    }
                }
                if ($jform.data('success-popup') == 'y') {
                    window.tildaForm.showSuccessPopup($jform.find('.js-successbox').html())
                } else {
                    $jform.find('.js-successbox').show()
                }
            }
            $jform.addClass('js-send-form-success');
            if (successcallback && successcallback.length > 0) {
                eval(successcallback + '($jform)')
            } else {
                if (successurl && successurl.length > 0) {
                    setTimeout(function() {
                        window.location.href = successurl
                    }, 500)
                }
            }
            tildaForm.clearTCart($jform);
            $jform.find('input[type=text]:visible').val('');
            $jform.find('textarea:visible').html('');
            $jform.find('textarea:visible').val('');
            $jform.data('tildaformresult', {
                tranid: "0",
                orderid: "0"
            })
        };
        window.tildaForm.send = function($jform, btnformsubmit, formtype, formskey) {
            window.tildaForm.tildapayment = !1;
            if ($jform.data('formcart') == 'y' || $jform.closest('.t706__orderform').length > 0) {
                window.tildaForm.addPaymentInfoToForm($jform)
            }
            if (formtype == 2 || (!formtype && formskey > '')) {
                var $inputElem;
                $inputElem = $jform.find('input[name=tildaspec-cookie]');
                if (!$inputElem || $inputElem.length == 0) {
                    $jform.append('<input type="hidden" name="tildaspec-cookie" value="">');
                    $inputElem = $jform.find('input[name=tildaspec-cookie]')
                }
                if ($inputElem.length > 0) {
                    $inputElem.val(document.cookie)
                }
                $inputElem = $jform.find('input[name=tildaspec-referer]');
                if (!$inputElem || $inputElem.length == 0) {
                    $jform.append('<input type="hidden" name="tildaspec-referer" value="">');
                    $inputElem = $jform.find('input[name=tildaspec-referer]')
                }
                if ($inputElem.length > 0) {
                    $inputElem.val(window.location.href)
                }
                $inputElem = $jform.find('input[name=tildaspec-formid]');
                if (!$inputElem || $inputElem.length == 0) {
                    $jform.append('<input type="hidden" name="tildaspec-formid" value="">');
                    $inputElem = $jform.find('input[name=tildaspec-formid]')
                }
                if ($inputElem.length > 0) {
                    $inputElem.val($jform.attr('id'))
                }
                if (formskey > '') {
                    $inputElem = $jform.find('input[name=tildaspec-formskey]');
                    if (!$inputElem || $inputElem.length == 0) {
                        $jform.append('<input type="hidden" name="tildaspec-formskey" value="">');
                        $inputElem = $jform.find('input[name=tildaspec-formskey]')
                    }
                    if ($inputElem.length > 0) {
                        $inputElem.val(formskey)
                    }
                }
                $inputElem = $jform.find('input[name=tildaspec-version-lib]');
                if (!$inputElem || $inputElem.length == 0) {
                    $jform.append('<input type="hidden" name="tildaspec-version-lib" value="">');
                    $inputElem = $jform.find('input[name=tildaspec-version-lib]')
                }
                if ($inputElem.length > 0) {
                    $inputElem.val(window.tildaForm.versionLib)
                }
                $inputElem = $jform.find('input[name=tildaspec-pageid]');
                if (!$inputElem || $inputElem.length == 0) {
                    $jform.append('<input type="hidden" name="tildaspec-pageid" value="">');
                    $inputElem = $jform.find('input[name=tildaspec-pageid]')
                }
                if ($inputElem.length > 0) {
                    $inputElem.val($('#allrecords').data('tilda-page-id'))
                }
                $inputElem = $jform.find('input[name=tildaspec-projectid]');
                if (!$inputElem || $inputElem.length == 0) {
                    $jform.append('<input type="hidden" name="tildaspec-projectid" value="">');
                    $inputElem = $jform.find('input[name=tildaspec-projectid]')
                }
                if ($inputElem.length > 0) {
                    $inputElem.val($('#allrecords').data('tilda-project-id'))
                }
                $jform.find('.js-form-spec-comments').val('');
                $formurl = 'https://' + window.tildaForm.endpoint + '/procces/';
                var d = {};
                d = $jform.serializeArray();
                d = d.filter(function(object) {
                    return object.name.indexOf('tildadelivery-') === -1
                });
                if (window.tildaForm.tildapayment && window.tildaForm.tildapayment.products) {
                    d.push({
                        name: 'tildapayment',
                        value: JSON.stringify(window.tildaForm.tildapayment)
                    })
                } else {
                    if ($jform.closest('.t706__orderform').length > 0) {
                        return !1
                    }
                }
                var tsstartrequest = Date.now();
                $.ajax({
                    type: "POST",
                    url: $formurl,
                    data: d,
                    dataType: "json",
                    xhrFields: {
                        withCredentials: !1
                    },
                    success: function(json) {
                        var successurl = $jform.data('success-url');
                        var successcallback = $jform.data('success-callback');
                        var formsendedcallback = $jform.data('formsended-callback');
                        btnformsubmit.removeClass('t-btn_sending');
                        btnformsubmit.data('form-sending-status', '0');
                        btnformsubmit.data('submitform', '');
                       
						alert('Ваша заявка принята.  В ближайшее время с вами свяжется наш менеджер.');
                    },
                    error: function(error) {
                      	alert('Ваша заявка принята.  В ближайшее время с вами свяжется наш менеджер.');
                    },
                    timeout: 15000
                });
                return !1
            } else {
                if ($jform.data('is-formajax') == 'y') {
                    var d = {};
                    d = $jform.serializeArray();
                    if (window.tildaForm.tildapayment && window.tildaForm.tildapayment.amount) {
                        d.push({
                            name: 'tildapayment',
                            value: JSON.stringify(window.tildaForm.tildapayment)
                        })
                    }
                    $.ajax({
                        type: "POST",
                        url: $jform.attr('action'),
                        data: d,
                        dataType: "text",
                        xhrFields: {
                            withCredentials: !1
                        },
                        success: function(html) {
                            var json;
                            var successurl = $jform.data('success-url');
                            var successcallback = $jform.data('success-callback');
                            btnformsubmit.removeClass('t-btn_sending');
                            btnformsubmit.data('form-sending-status', '0');
                            btnformsubmit.data('submitform', '');
                            if (html && html.length > 0) {
                                if (html.substring(0, 1) == '{') {
                                    if (window.JSON && window.JSON.parse) {
                                        json = window.JSON.parse(html)
                                    } else {
                                        json = $.parseJSON(html)
                                    }
                                    if (json && json.message) {
                                        if (json.message != 'OK') {
                                            $jform.find('.js-successbox').html(json.message)
                                        }
                                    } else {
                                        if (json && json.error) {
                                            var $errBox = $jform.find('.js-errorbox-all');
                                            if (!$errBox || $errBox.length == 0) {
                                                $jform.prepend('<div class="js-errorbox-all"></div>');
                                                $errBox = $jform.find('.js-errorbox-all')
                                            }
                                            var $allError = $errBox.find('.js-rule-error-all');
                                            if (!$allError || $allError.length == 0) {
                                                $errBox.append('<p class="js-rule-error-all">Unknown error. Please, try again later.</p>');
                                                $allError = $errBox.find('.js-rule-error-all')
                                            }
                                            $allError.html(json.error);
                                            $allError.show();
                                            $errBox.show();
                                            $jform.addClass('js-send-form-error');
                                            $jform.trigger('tildaform:aftererror');
                                            return !1
                                        }
                                    }
                                } else {
                                    $jform.find('.js-successbox').html(html)
                                }
                            }
                            var virtPage = '/tilda/' + $jform.attr('id') + '/submitted/';
                            var virtTitle = 'Send data from form ' + $jform.attr('id');
                            if (window.Tilda && typeof Tilda.sendEventToStatistics == 'function') {
                                window.Tilda.sendEventToStatistics(virtPage, virtTitle, '', 0)
                            } else {
                                if (typeof ga != 'undefined') {
                                    if (window.mainTracker != 'tilda') {
                                        ga('send', {
                                            'hitType': 'pageview',
                                            'page': virtPage,
                                            'title': virtTitle
                                        })
                                    }
                                }
                                if (window.mainMetrika > '' && window[window.mainMetrika]) {
                                    window[window.mainMetrika].hit(virtPage, {
                                        title: virtTitle,
                                        referer: window.location.href
                                    })
                                }
                            }
                            $jform.trigger('tildaform:aftersuccess');
                            window.tildaForm.successEnd($jform, successurl, successcallback)
                        },
                        error: function(error) {
                            btnformsubmit.removeClass('t-btn_sending');
                            btnformsubmit.data('form-sending-status', '0');
                            btnformsubmit.data('submitform', '');
                            var $errBox = $jform.find('.js-errorbox-all');
                            if (!$errBox || $errBox.length == 0) {
                                $jform.prepend('<div class="js-errorbox-all"></div>');
                                $errBox = $jform.find('.js-errorbox-all')
                            }
                            var $allError = $errBox.find('.js-rule-error-all');
                            if (!$allError || $allError.length == 0) {
                                $errBox.append('<p class="js-rule-error-all"></p>');
                                $allError = $errBox.find('.js-rule-error-all')
                            }
                            if (error && error.responseText > '') {
                                $allError.html(error.responseText + '. Please, try again later.')
                            } else {
                                if (error && error.statusText) {
                                    $allError.html('Error [' + error.statusText + ']. Please, try again later.')
                                } else {
                                    $allError.html('Unknown error. Please, try again later.')
                                }
                            }
                            $allError.show();
                            $errBox.show();
                            $jform.addClass('js-send-form-error');
                            $jform.trigger('tildaform:aftererror')
                        },
                        timeout: 15000
                    });
                    return !1
                } else {
                    var attraction = $jform.attr('action');
                    if (attraction.indexOf(window.tildaForm.endpoint) == -1) {
                        btnformsubmit.data('form-sending-status', '3');
                        $jform.submit();
                        return !0
                    } else {
                        return !1
                    }
                }
            }
        };
        $('.js-tilda-captcha').each(function() {
            if ($(this).attr('data-tilda-captchakey') > '') {
                if (window.tildaForm.isRecaptchaScriptInit === !1) {
                    window.tildaForm.isRecaptchaScriptInit = !0;
                    $('head').append('<script src="https://www.google.com/recaptcha/api.js?render=explicit"' + ' async defer><' + '/script>');
                    $('head').append('<style type="text/css">.js-send-form-success .grecaptcha-badge {display: none;}</style>')
                }
                var idform = $(this).attr('id');
                if ($('#' + idform + 'recaptcha').length == 0) {
                    $(this).append('<div id="' + idform + 'recaptcha" class="g-recaptcha" data-sitekey="' + $(this).attr('data-tilda-captchakey') + '" data-callback="window.tildaForm.captchaCallback" data-size="invisible"></div>')
                }
            } else {
                $(this).removeClass('js-tilda-captcha')
            }
        });
        window.tildaForm_initMasks = function() {
            $('.js-tilda-mask').each(function() {
                var mask = $(this).data('tilda-mask');
                var maskplaceholder = $(this).data('tilda-mask-holder');
                if (mask && !$(this).data('tilda-mask-init')) {
                    if (maskplaceholder && maskplaceholder > '') {
                        $(this).mask('' + mask, {
                            placeholder: '' + maskplaceholder
                        })
                    } else {
                        $(this).mask('' + mask)
                    }
                    $(this).data('tilda-mask-init', '1')
                }
            })
        };
        window.tildaForm_initMasks();
        $('.r').off('focus', '.js-tilda-rule');
        $('.r').on('focus', '.js-tilda-rule', function() {
            var str = $(this).attr('placeholder');
            if (str && str.length > 0) {
                $(this).data('placeholder', str);
                $(this).attr('placeholder', '')
            }
        });
        $('.r').off('blur', '.js-tilda-rule');
        $('.r').on('blur', '.js-tilda-rule', function() {
            var str = $(this).data('placeholder');
            if (str > '') {
                $(this).attr('placeholder', str);
                $(this).data('placeholder', '')
            }
        });
        window.validateForm = function($jform) {
            return window.tildaForm.validate($jform)
        }
        var $jallforms = $('.r').find('.js-form-proccess[data-formactiontype]');
        if ($jallforms.length > 0) {
            $jallforms.each(function() {
                if ($(this).data('formactiontype') != 1) {
                    $(this).append('<div style="position: absolute; left: -5000px; bottom:0;"><input type="text" name="form-spec-comments" value="Its good" class="js-form-spec-comments"  tabindex="-1" /></div>')
                }
            })
        }
        $('.r').find('.js-form-procces').each(function() {
            try {
                var formtype = $(this).data('formactiontype');
                if (formtype == 2) {
                    $(this).attr('action', '#')
                }
            } catch (e) {
                console.log(e)
            }
        });
        $('.r').off('submit', '.js-form-proccess');
        $('.r').on('submit', '.js-form-proccess', function(e) {
            var btnformsubmit = $(this).find('[type=submit]');
            var btnstatus = btnformsubmit.data('form-sending-status');
            if (btnstatus && btnstatus == 3) {
                btnformsubmit.data('form-sending-status', '');
                return !0
            } else {
                if ($(this).find('[type=submit]').hasClass('t706__submit_disable')) {} else {
                    $(this).find('[type=submit]').trigger('click')
                }
                return !1
            }
        });
        $('.r').on('dblclick', '.js-form-proccess [type=submit]', function(e) {
            e.preventDefault();
            return !1
        });
        $('.r').off('click', '.js-form-proccess [type=submit]');
        $('.r').on('click', '.js-form-proccess [type=submit]', function(event) {
            event.preventDefault();
            var btnformsubmit = $(this);
            var btnstatus = btnformsubmit.data('form-sending-status');
            if (btnstatus >= '1') {
                return !1
            }
            if ($(this).hasClass('t706__submit_disable')) {
                return !1
            }
            var $activeForm = $(this).closest('form'),
                arErrors = !1;
            if ($activeForm.length == 0) {
                return !1
            }
            btnformsubmit.addClass('t-btn_sending');
            btnformsubmit.data('form-sending-status', '1');
            btnformsubmit.data('submitform', $activeForm);
            window.tildaForm.hideErrors($activeForm);
            arErrors = window.tildaForm.validate($activeForm);
            if (window.tildaForm.showErrors($activeForm, arErrors)) {
                btnformsubmit.removeClass('t-btn_sending');
                btnformsubmit.data('form-sending-status', '0');
                btnformsubmit.data('submitform', '');
                return !1
            } else {
                var formtype = $activeForm.data('formactiontype');
                var formskey = $('#allrecords').data('tilda-formskey');
                if ($activeForm.find('.js-formaction-services').length == 0 && formtype != 1 && formskey == '') {
                    var $errBox = $activeForm.find('.js-errorbox-all');
                    if (!$errBox || $errBox.length == 0) {
                        $activeForm.prepend('<div class="js-errorbox-all"></div>');
                        $errBox = $activeForm.find('.js-errorbox-all')
                    }
                    var $allError = $errBox.find('.js-rule-error-all');
                    if (!$allError || $allError.length == 0) {
                        $errBox.append('<p class="js-rule-error-all">' + json.error + '</p>');
                        $allError = $errBox.find('.js-rule-error-all')
                    }
                    $allError.html('Please set receiver in block with forms').show();
                    $errBox.show();
                    $activeForm.addClass('js-send-form-error');
                    btnformsubmit.removeClass('t-btn_sending');
                    btnformsubmit.data('form-sending-status', '0');
                    btnformsubmit.data('submitform', '');
                    $activeForm.trigger('tildaform:aftererror');
                    return !1
                }
                if ($activeForm.find('.g-recaptcha').length > 0 && grecaptcha) {
                    window.tildaForm.currentFormProccessing = {
                        form: $activeForm,
                        btn: btnformsubmit,
                        formtype: formtype,
                        formskey: formskey
                    };
                    var captchaid = $activeForm.data('tilda-captcha-clientid');
                    if (captchaid === undefined || captchaid === '') {
                        var opts = {
                            size: 'invisible',
                            sitekey: $activeForm.data('tilda-captchakey'),
                            callback: window.tildaForm.captchaCallback
                        };
                        captchaid = grecaptcha.render($activeForm.attr('id') + 'recaptcha', opts);
                        $activeForm.data('tilda-captcha-clientid', captchaid)
                    } else {
                        grecaptcha.reset(captchaid)
                    }
                    grecaptcha.execute(captchaid);
                    return !1
                }
                window.tildaForm.send($activeForm, btnformsubmit, formtype, formskey)
            }
            return !1
        });
        try {
            var TILDAPAGE_URL = window.location.href,
                TILDAPAGE_QUERY = '',
                TILDAPAGE_UTM = '';
            if (TILDAPAGE_URL.toLowerCase().indexOf('utm_') !== -1) {
                TILDAPAGE_URL = TILDAPAGE_URL.toLowerCase();
                TILDAPAGE_QUERY = TILDAPAGE_URL.split('?');
                TILDAPAGE_QUERY = TILDAPAGE_QUERY[1];
                if (typeof(TILDAPAGE_QUERY) == 'string') {
                    var arPair, i, arParams = TILDAPAGE_QUERY.split('&');
                    for (i in arParams) {
                        if (typeof(arParams[i]) != 'function') {
                            arPair = arParams[i].split('=');
                            if (arPair[0].substring(0, 4) == 'utm_') {
                                TILDAPAGE_UTM = TILDAPAGE_UTM + arParams[i] + '|||'
                            }
                        }
                    }
                    if (TILDAPAGE_UTM.length > 0) {
                        var date = new Date()
                        date.setDate(date.getDate() + 30);
                        document.cookie = "TILDAUTM=" + encodeURIComponent(TILDAPAGE_UTM) + "; path=/; expires=" + date.toUTCString()
                    }
                }
            }
        } catch (err) {}
    })
})(jQuery)