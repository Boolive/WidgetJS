/**
 * WidgetJS 1.0.0
 *
 * @author Vladimir Shestakov
 * @git https://github.com/Boolive/WidgetJS
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */
if (typeof Object.create != 'function') {
  Object.create = (function() {
    var Temp = function() {};
    return function (prototype) {
      if (arguments.length > 1) {
        throw new Error('Second argument not supported');
      }
      if (typeof prototype != 'object') {
        throw new TypeError('Argument must be an object');
      }
      Temp.prototype = prototype;
      var result = new Temp();
      Temp.prototype = null;
      return result;
    };
  })();
}
/**
 * UI factory
 */
var WidgetJS = (function($){
    var classes = {};
    var oldClean = $.cleanData;
    $.cleanData = function( elems ) {
        for ( var i = 0, elem; (elem = elems[i]) !== undefined; i++ ) {
            if (elem.widget) elem.widget.destroy();
        }
        oldClean(elems);
    };

    $(document).ready(function(){
        $('[data-widget]').each(function(){
            var $element = $(this), options;
            if ($element.attr('data-options')){
                options = $.getJSON($element.attr('data-options'));
            }else{
                options = {};
            }
            WidgetJS.create($element.attr('data-widget'), $element, options);
        });
    });

    return {
        /**
         * Define new widget class
         * @param name
         * @param extend
         * @param object
         */
        define: function (name, extend, object) {
            var prototype, obj = {};
            if (typeof extend === 'string') {
                prototype = /*new (WidgetJS.getClass(extend))();//*/Object.create(classes[extend].prototype);
            } else {
                prototype = {};
                if (typeof object === 'undefined') {
                    object = extend;
                }
            }
            prototype.name = name;
            for (var prop in object) {
                if (object.hasOwnProperty(prop)) {
                    if (typeof object[prop] === 'function') {
                        prototype[prop] = object[prop]
                    } else {
                        obj[prop] = object[prop];
                    }
                }
            }

            classes[name] = function ($element, options) {
                for (var prop in obj){
                    this[prop] = obj[prop];
                }
                this.$element = $element;
                this.$element[0].widget = this;
                this.options = options || {};
                this.id = WidgetJS.uniqueId();
                this.eventNamespace = '.' + this.name + '-' + this.id;
            };
            prototype.constructor = classes[name];
            classes[name].prototype = prototype;
        },
        /**
         * Create new widget instance
         * @param name String Имя класса
         * @param $element jQuery
         * @param options Object
         */
        create: function (name, $element, options) {
            var w = new classes[name]($element, options);
            w.create();
            return w;
        },

        getClass: function (name) {
            return classes[name];
        },

        uniqueId: (function () {
            var count = 0;
            return function () {
                return (count += 1);
            };
        })()
    }
})(jQuery);


(function($, undefined) {
    /**
     * Base widget
     */
    WidgetJS.define('Widget', null, {

        name: 'Widget',

        options: {},

        _parent: undefined,

        _children: undefined,

        create: function () {
            var self = this;
            this._children = {};
            // Добавление нового подчиненного в свой список
            this.$element.on('_create'+this.eventNamespace, function(e, widget){
                return !self._addChild(widget);
            });
            // Удаление подчиенного из списка
            this.$element.on('_destroy'+this.eventNamespace, function(e, widget){
                return !self._deleteChild(widget);
            });
            // Сообщаем родителю о своём создании
            this.$element.trigger('_create', [this]);

            console.log(this/* instanceof WidgetJS.getClass('Widget')*/);
        },
        destroy: function () {
            // Сообщаем родителю о своём удалении
            this.$element.trigger('_destroy', [this]);

            console.log('destroy: ' + this.name);
        },
        /**
         * Вызов дейсвтия у подчиненных
         * @param name Название действия (функции)
         * @param args Массив аргументов
         * @param target Объект, иницировавший вызов действия. По умолчанию this
         */
        broadcast: function(name, args, target){
            var stop = undefined;
            if (target){
                if ($.isFunction(this['on_'+name])){
                    if (!$.isArray(args)) args = [args];
                    var a = [{target: target, type: 'broadcast'}].concat(args);
                    stop = this['on_'+name].apply(this, a);
                }
            }
            if (stop !== undefined){
                return stop;
            }
            var result = [];
            for (var child in this._children){
                stop = this._children[child].broadcast(name, args, target || this);
                if (stop !== undefined){
                    result.push(stop);
                }
            }
            return result.length? result : undefined;
        },
        /**
         * Вызов дейсвтия у родителей
         * @param name Название действия (функции)
         * @param args Массив аргументов
         * @param target Объект, иницировавший вызов действия. По умолчанию this.
         * @param up Признак, когда вызов дойдет до корневого объекты, перенаправить вызов всем подчиненным.
         */
        emit: function(name, args, target, up){
            if (!target) target = null;
            var stop = undefined;
            if (!up && target){
                if ($.isFunction(this['on_'+name])){
                    if (!$.isArray(args)) args = [args];
                    var a = [{target: target, type: 'emit'}].concat(args);
                    stop = this['on_'+name].apply(this, a);
                }
            }
            if (stop !== undefined){
                return stop;
            }else
            if (this._parent){
                return this._parent.emit(name, args, target || this, up);
            }else
            if (up){
                return this.emit(name, args, target);
            }
            return undefined;
        },
        /**
         * Добавление подчиненного виджета
         * @param widget Объект виджета
         * @return {Boolean}
         * @private
         */
        _addChild: function(widget){
            if (widget != this){
                this._children[widget.id] = widget;
                widget._parent = this;
                return true;
            }
            return false;
        },
        /**
         * Удаление подчиненного виджета
         * @param widget Объект виджета
         * @return {Boolean}
         * @private
         */
        _deleteChild: function(widget){
            if (widget != this){
                delete this._children[widget.id];
                return true;
            }
            return false;
        },
        _super: function(classname){
            return WidgetJS.getClass(classname).prototype;
        }
    });

})(jQuery);