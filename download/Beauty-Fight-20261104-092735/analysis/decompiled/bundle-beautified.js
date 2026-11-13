
 //xz 多语言配置表
 window.flip_language_map = {
    Not_Enough_Diamonds:{
        en:"Not enough diamonds",
        ru:"Недостаточно бриллиантов",
        tr:"No hay suficientes diamantes",
        de:"Nicht genug Diamanten",
        ja:"ダイヤモンドが足りない",
        es:"No hay suficientes diamantes",
        ar:"ليس هناك ما يكفي من الماس",
    },
    Get_Success:{
        en:"Get success",
        ru:"Получите успех",
        tr:"Conseguir el éxito",
        de:"Erfolg haben",
        ja:"成功を手に入れる",
        es:"Conseguir el éxito",
        ar:"احصل على النجاح",
    },
    Get_Success_Diamond:{
        en:"Get Success Diamond",
        ru:"Получите успех алмаз",
        tr:"Obtenga el Diamante del Éxito",
        de:"Erfolgreich empfangen",
        ja:"成功ダイヤモンドを手に入れる",
        es:"Obtenga éxito",
        ar:"احصل على النجاح",
    },
    LV:{
        en:"Level",
        ru:"Ур",
        tr:"Level",
        de:"Level",
        ja:"Level",
        es:"Level",
        ar:"Level",
    },
    Open:{
        en:"Open",
        ru:"Открыть",
        tr:"Abierto",
        de:"Offen",
        ja:"開ける",
        es:"Abierto",
        ar:"يفتح",
    },
    Closing:{
        en:"Closing",
        ru:"Закрытие",
        tr:"Cierre",
        de:"Schließen",
        ja:"終わりに",
        es:"Cierre",
        ar:"إغلاق",
    },
}
//xz 
/**
 * des: 根据key获取对应语言，也可以传入参数动态替换;
 * 例子：window.getLanguageByKey("test",[10,5]);
 * 输出：'I am a 10 year old 5 child.'
*/
window.getLanguageByKey = function(key,params = []){
    let item = window.flip_language_map[key];
    if(!item){
        return "";
    }
    let text = item[VkApp.GAME_LANGUAGE] || "";
    if(params.length){
        text = window.getStringReplace(text,params);
    }
    return text;
}
//支持(0)(1)括号格式的字符替换
window.getStringReplace = function(s, params) {
    if (params.length == 0) return s;
    for (var i = 0; i < params.length; i++)
        s = s.replace(new RegExp("\\(" + i + "\\)", "g"), params[i]);
    return s;
}

! function () {
    "use strict";
    var e, t, i, s = Laya.ClassUtils.regClass;
    ! function (e) {
        ! function (e) {
            class t extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/ChallengeLevel")
                }
            }
            e.ChallengeLevelUI = t, s("ui.test.ChallengeLevelUI", t);
            class i extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/DefineSkin")
                }
            }
            e.DefineSkinUI = i, s("ui.test.DefineSkinUI", i);
            class a extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/FailScene")
                }
            }
            e.FailSceneUI = a, s("ui.test.FailSceneUI", a);
            class n extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/Fashion")
                }
            }
            e.FashionUI = n, s("ui.test.FashionUI", n);
            class r extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/FreeSkin")
                }
            }
            e.FreeSkinUI = r, s("ui.test.FreeSkinUI", r);
            class o extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/GameScene")
                }
            }
            e.GameSceneUI = o, s("ui.test.GameSceneUI", o);
            class l extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/Loading")
                }
            }
            e.LoadingUI = l, s("ui.test.LoadingUI", l);
            class h extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/Setting")
                }
            }
            e.SettingUI = h, s("ui.test.SettingUI", h);
            class c extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/Shop")
                }
            }
            e.ShopUI = c, s("ui.test.ShopUI", c);
            class d extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/TrySkin")
                }
            }
            e.TrySkinUI = d, s("ui.test.TrySkinUI", d);
            class _ extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/Turntable")
                }
            }
            e.TurntableUI = _, s("ui.test.TurntableUI", _);
            class m extends Laya.Scene {
                constructor() {
                    super()
                }
                createChildren() {
                    super.createChildren(), this.loadScene("test/VictoryScene")
                }
            }
            e.VictorySceneUI = m, s("ui.test.VictorySceneUI", m)
        }(e.test || (e.test = {}))
    }(e || (e = {}));
    class a {
        static setScale(e) {
            e.scale(Laya.stage.width / 640, Laya.stage.width / 640)
        }
        static getScaleRate() {
            return Laya.stage.width / 640
        }
        static mouseX() {
            return Laya.stage.mouseX / a.getScaleRate()
        }
        static mouseY() {
            return Laya.stage.mouseY / a.getScaleRate()
        }
        static height() {
            return Laya.stage.height / a.getScaleRate()
        }
        static width() {
            return Laya.stage.width / a.getScaleRate()
        }
        static localToGlobal(e, t) {
            var i = e.localToGlobal(t, !1);
            return i.x = i.x / a.getScaleRate(), i.y = i.y / a.getScaleRate(), i
        }
    }
    class n {
        constructor() {}
        static load(e) {
            n.item_json = e, n.unlock_lib = n.item_json.unlock_lib, n.user_unlock_box = n.item_json.user_unlock_box
        }
        static geUnlockLibByID(e) {
            return n.unlock_lib[e]
        }
        static geUserUnlockByID(e) {
            return n.user_unlock_box[e]
        }
        static setUserUnlockValueByID(e, t, i) {
            n.user_unlock_box[e][t] = i, p.saveToLocalStorage()
        }
        static isUserUnlockCanTrigger(e) {
            var t = n.geUnlockLibByID(e);
            if (t) {
                var i = t.con;
                return i.length < 1 || n.condition(i)
            }
            return !1
        }
        static condition(e) {
            var t, i, s, a;
            if (e.indexOf(":") > -1) {
                var r = e.split(":"),
                    o = r[0].split("==");
                i = o[0], s = o[1], t = r[1]
            } else t = e;
            if (t.indexOf("==") > -1 ? a = "==" : t.indexOf(">=") > -1 && (a = ">="), a) {
                var l = t.split(a),
                    h = l[0],
                    c = Number(l[1]);
                if (i && s) {
                    if ("mid" == i) {
                        var d = n.geUserUnlockByID(Number(s));
                        if ("==" == a) {
                            if (d[h] == c) return !0
                        } else if (">=" == a && d[h] >= c) return !0
                    }
                } else {
                    var _ = p.get(h);
                    if ("==" == a) {
                        if (_ == c) return !0
                    } else if (">=" == a && _ >= c) return !0
                }
            }
            return !1
        }
        static Update(e) {
            for (var t = 1; t < n.unlock_lib.length; t++) {
                var i = n.geUnlockLibByID(t),
                    s = n.geUserUnlockByID(t);
                if (null == s) return;
                var a = n.isUserUnlockCanTrigger(t);
                1 == i.ty ? a && 0 == s.sd && (n.setUserUnlockValueByID(t, "sd", 1), e(i)) : 2 == i.ty && a && 0 == s.sd && (n.setUserUnlockValueByID(t, "sd", 1), e(i))
            }
        }
    }
    class r {
        constructor() {}
        static refresh() {
            var e = r.getLastCheckinDay();
            if (7 == e[1] && !e[0])
                for (var t = 1; t < 8; t++) {
                    var i = l.getTaskByProgressType("check_in", t);
                    l.user_task_box[i.id].ft = 0
                }
        }
        static getState(e) {
            var t = l.getTaskByProgressType("check_in", e),
                i = l.getTaskState(t);
            return 1 == i ? r.getLastCheckinDay()[0] ? 0 : i : (-1 == i && (i = 0), i)
        }
        static getLastCheckinDay() {
            for (var e = 0, t = 0, i = 1; i < 8; i++) {
                var s = l.getTaskByProgressType("check_in", i),
                    a = l.user_task_box[s.id];
                a.prc = Math.round(p.get("check_in") % 7) + 1, a.ft > 0 && (e = a.ft, t = i)
            }
            return [l.timestampToDate(e) == l.timestampToDate((new Date).getTime()), t]
        }
        static completeTask(e) {
            if (1 == r.getState(e)) {
                var t = l.getTaskByProgressType("check_in", e);
                return l.user_task_box[t.id].ft = (new Date).getTime(), p.add("check_in", 1), r.refresh(), !0
            }
            return !1
        }
        static getList() {
            for (var e = new Array, t = 1; t < l.task_lib.length; t++) {
                var i = l.task_lib[t];
                4 == i.ty && e.push(i)
            }
            return e
        }
        static checkTodayBoolCheck() {
            let e = r.getList(),
                t = !0;
            for (let i = 0; i < e.length; i++) {
                let s = e[i];
                1 == r.getState(s.prt) && (t = !1)
            }
            return t
        }
    }
    class o {
        constructor() {}
        static refresh() {
            for (var e = 1; e < l.task_lib.length; e++) {
                var t = l.task_lib[e];
                if ("level" == t.prty) l.getUserTaskByID(t.id).prc = p.get("level")
            }
        }
        static getState(e) {
            this.refresh(), null == e && (e = p.get("level"));
            var t = l.getTaskByProgressType("level", e);
            return t ? l.getTaskState(t) : -1
        }
        static completeTask(e) {
            null == e && (e = p.get("level"));
            var t = l.getTaskByProgressType("level", e);
            return l.completeTask(t)
        }
    }
    class l {
        constructor() {}
        static load(e) {
            l.item_json = e, l.task_lib = l.item_json.task_lib, l.user_task_box = l.item_json.user_task_box, r.refresh(), o.refresh()
        }
        static getTaskState(e) {
            var t = l.getUserTaskByID(e.id);
            if (t) {
                if (t.ft > 0) return 2;
                if (t.prc >= e.prt) return 1;
                var i = l.task_lib[e.pid];
                return 2 == l.getTaskState(i) && (t.vt - (new Date).getTime() > 0 || 0 == t.vt) ? 0 : -1
            }
            return null
        }
        static getUserTaskByID(e) {
            return l.user_task_box[e]
        }
        static completeTask(e) {
            l.getTaskState(e);
            return 1 ? (l.getUserTaskByID(e.id).ft = (new Date).getTime(), e) : null
        }
        static getProgress(e) {
            return [e.prt, l.user_task_box[e.id].prc]
        }
        static incUserTaskProgress(e, t) {
            if (0 == l.getTaskState(e)) {
                var i = l.getUserTaskByID(e.id);
                return i.prc += t, i
            }
            return null
        }
        static getTaskByProgressType(e, t) {
            for (var i = 1; i < l.task_lib.length; i++) {
                var s = l.task_lib[i];
                if (s.prty == e && s.prt == t) return s
            }
            return null
        }
        static findOneTask(e, t, i, s) {
            for (var a = 1; a < l.task_lib.length; a++) {
                var n = l.task_lib[a],
                    r = null == e || n.ty == e,
                    o = null == t || n.pid == t,
                    h = null == i || n.prty == i,
                    c = null == s || n.prt == s;
                if (r && o && h && c) return n
            }
        }
        static findOneTargetTask(e, t) {
            for (var i = 1; i < l.task_lib.length; i++) {
                var s = l.task_lib[i],
                    a = null == e || s.ty == e,
                    n = null == t || s.pid == t;
                if (a && n) return s
            }
        }
        static timestampToDate(e) {
            var t = new Date(e);
            return t.getFullYear() + "-" + ((t.getMonth() + 1 < 10 ? "0" + (t.getMonth() + 1) : t.getMonth() + 1) + "-") + t.getDate()
        }
        static getTodayEndTime() {
            return new Date(new Date((new Date).toLocaleDateString()).getTime() + 864e5 - 1).getTime()
        }
        static isValidTime(e, t) {
            return !!t || !(e.vt - (new Date).getTime() < 0)
        }
    }
    class h {
        constructor(e, t, i, s, a, n) {
            this.state = e, this.item = t, this.price_type_key = i, this.price = s, this.user_has = a, this.task = n
        }
        static itemCondition(e, t) {
            let i, s, a = t.split("="),
                n = a[0],
                r = Number(a[1]),
                o = d.getUserBoxItem(e);
            if (!o) return null;
            if (t.indexOf(d.PRICE_TYPE_TASK) > -1) {
                let t = r,
                    a = l.task_lib[t];
                switch (l.getTaskState(a)) {
                    case -1:
                    case 0:
                    case 1:
                        s = h.STATE_CONDITION_MET_NOT;
                        break;
                    case 2:
                        s = h.STATE_CONDITION_MET_READY
                }
                s = o.num >= e.mx ? h.STATE_CONDITION_MET_CONFIRM : s;
                let c = a.prt,
                    d = l.user_task_box[t].prc;
                i = new h(s, e, n, c, d, a)
            } else if (t.indexOf(d.PRICE_TYPE_CUR) > -1) {
                let t = n.split("_")[0];
                s = r <= p.get(t) ? h.STATE_CONDITION_MET_READY : h.STATE_CONDITION_MET_NOT, s = o.num >= e.mx ? h.STATE_CONDITION_MET_CONFIRM : s, i = new h(s, e, n, r, p.get(t), null)
            } else if (t.indexOf(d.PRICE_TYPE_CHIP) > -1) {
                n.split("_")[0];
                let t = d.user_item_box[e.cid];
                s = r <= t.num ? h.STATE_CONDITION_MET_READY : h.STATE_CONDITION_MET_NOT, s = o.num >= e.mx ? h.STATE_CONDITION_MET_CONFIRM : s, i = new h(s, e, n, r, t.num, null)
            } else i = t.indexOf("init") > -1 ? new h(h.STATE_CONDITION_MET_CONFIRM, e, n, 0, 0, null) : new h(h.STATE_CONDITION_MET_NOT, e, "", 0, 0, null);
            return i
        }
        static conditionMerge(e, t, i) {
            return e == this.STATE_CONDITION_MET_CONFIRM || t == this.STATE_CONDITION_MET_CONFIRM ? this.STATE_CONDITION_MET_CONFIRM : i.indexOf("&") > -1 ? e == this.STATE_CONDITION_MET_NOT || t == this.STATE_CONDITION_MET_NOT ? this.STATE_CONDITION_MET_NOT : this.STATE_CONDITION_MET_READY : e == this.STATE_CONDITION_MET_READY || t == this.STATE_CONDITION_MET_READY ? this.STATE_CONDITION_MET_READY : this.STATE_CONDITION_MET_NOT
        }
        static itemAllConditions(e) {
            for (var t = e.pt.split(/[&|]/), i = e.pt.match(/[&|]/g), s = -1, a = new Array, n = 0; n < t.length; n++) {
                var r = this.itemCondition(e, t[n]);
                a.push(r)
            }
            if (a.length > 1)
                for (n = 1; n < t.length; n++) s = -1 == s ? this.conditionMerge(a[n - 1].state, a[n].state, i[n - 1]) : this.conditionMerge(s, a[n].state, i[n - 1]);
            else s = a[0].state;
            return new c(s, a)
        }
    }
    h.STATE_CONDITION_MET_NOT = 0, h.STATE_CONDITION_MET_READY = 1, h.STATE_CONDITION_MET_CONFIRM = 2;
    class c {
        constructor(e, t) {
            this.state = e, this.conditions = t
        }
    }
    class d {
        constructor() {}
        static load(e) {
            d.item_json = e, d.item_lib = d.item_json.item_lib, d.user_item_box = d.item_json.user_item_box
        }
        static getItemByID(e) {
            return d.item_lib[e]
        }
        static getUserBoxItem(e) {
            return d.user_item_box[e.id]
        }
        static getUserBoxChipItem(e) {
            return d.user_item_box[e.cid]
        }
        static incItem(e, t = 1) {
            var i = d.getUserBoxItem(e);
            return i.num += t, i
        }
        static incItemChip(e, t = 1) {
            if (e.cid > 0) {
                var i = this.getItemByID(e.cid);
                return e.pt.indexOf(this.PRICE_TYPE_SHARE) > -1 ? p.add(this.PRICE_TYPE_SHARE, 1) : e.pt.indexOf(this.PRICE_TYPE_VIDEO) > -1 && p.add(this.PRICE_TYPE_VIDEO, 1), d.incItem(i, t)
            }
            return console.warn("incItemChip->item['cid'] <=0!"), null
        }
        static decItem(e, t = 1) {
            var i = d.getUserBoxItem(e);
            return t <= i.num ? i.num -= t : i.num = 0, i
        }
        static mergeItem(e, t) {
            if (e.state != h.STATE_CONDITION_MET_READY) return !1;
            for (var i = 0; i < e.conditions.length; i++) {
                var s = e.conditions[i];
                if (s.price_type_key.indexOf(t) > -1) {
                    if (s.state != h.STATE_CONDITION_MET_READY) return !1;
                    var a = s.item;
                    if (s.price_type_key.indexOf(this.PRICE_TYPE_CHIP) > -1) {
                        var n = d.getUserBoxChipItem(a);
                        d.decItem(n, s.price)
                    } else s.price_type_key.indexOf(this.PRICE_TYPE_CUR) > -1 ? p.dec(t, s.price) : s.price_type_key.indexOf(this.PRICE_TYPE_TASK);
                    return d.incItem(a), !0
                }
            }
            return !1
        }
        static getItemsConditionsByType(e, t) {
            for (var i = new Array, s = 1; s < d.item_lib.length; s++) {
                var a = d.item_lib[s];
                if (a.ty == e && a.sid == t) {
                    var n = h.itemAllConditions(a);
                    i.push(n)
                }
            }
            return i
        }
        static getItemState(e) {
            var t = this.getItemByID(e);
            return h.itemAllConditions(t)
        }
        static getChipPrice(e) {
            if (e.pt.indexOf("|") > -1) {
                for (var t = e.pt.split("|"), i = 0; i < t.length; i++)
                    if (t[i].indexOf("chip") > -1) {
                        var s = t[i].split("_");
                        return Number(s)
                    }
            } else {
                if (!(e.pt.indexOf("&") > -1)) {
                    s = e.pt.split("_");
                    return Number(s)
                }
                for (t = e.pt.split("&"), i = 0; i < t.length; i++)
                    if (t[i].indexOf("chip") > -1) {
                        var s = t[i].split("_");
                        return Number(s)
                    }
            }
        }
        static getCurPrice(e) {
            if (e.pt.indexOf("/") > 0) {
                var t = e.p.split("/");
                return Number(t[0])
            }
            return Number(e.p)
        }
        static setUserYn(e, t = 0) {
            d.user_item_box[e.id].yn = t
        }
        static setUserIv(e, t = 0) {
            d.user_item_box[e.id].iv = t
        }
        static setUserVn(e, t = 0) {
            d.user_item_box[e.id].vn = t
        }
    }
    d.PRICE_TYPE_CHIP = "chip", d.PRICE_TYPE_CUR = "cur", d.PRICE_TYPE_VIDEO = "video", d.PRICE_TYPE_SHARE = "share", d.PRICE_TYPE_TASK = "task";
    class _ {
        constructor() {}
        static getIntegerInND(e, t, i, s) {
            var a = _.getNumberInNormalDistribution(e, t);
            return a = (a = a > i ? i : a) < s ? s : a, Math.round(a)
        }
        static getRealInND(e, t, i, s) {
            var a = _.getNumberInNormalDistribution(e, t);
            return a = (a = a > i ? i : a) < s ? s : a
        }
        static getNumberInNormalDistribution(e, t) {
            return e + _.uniform2NormalDistribution() * t
        }
        static uniform2NormalDistribution() {
            for (var e = 0, t = 0; t < 12; t++) e += Math.random();
            return e - 6
        }
        static getIntegerInRandom(e, t) {
            return Math.round(_.getRealInRandom(e, t))
        }
        static getRealInRandom(e, t) {
            var i = e - t;
            return t + Math.random() * i
        }
        static getBoolInRandom(e) {
            return e > Math.random()
        }
        static ArrayShuffle(e) {
            let t = e.concat();
            for (let e = t.length - 1; e > 0; e--) {
                let i = Math.floor(e * Math.random());
                [t[e], t[i]] = [t[i], t[e]]
            }
            return t
        }
    }
    class m {
        constructor() {}
        static load(e) {
            m.item_json = e, m.user_equip_box = m.item_json.user_equip_box
        }
        static setFuncList(e) {
            this.func_list = e
        }
        static getEquipByID(e) {
            let t = m.user_equip_box;
            for (let i = 0; i < t.length; i++) {
                let s = t[i];
                if (s.id == e) return s
            }
            return null
        }
        static getEquipNewId() {
            let e = -1;
            return this.user_equip_box.forEach(t => {
                let i = t.id;
                i > e && (e = i)
            }), e + 1
        }
        static createEquip(e, t, i = [], s = 0, a = 0) {
            return new u(-1, e, t, i, s, a)
        }
        static putEquipInBox(e) {
            let t = this.getEquipNewId();
            e.id = t;
            let i = e.toJson();
            return m.user_equip_box.push(i), this.SAVE_AUTO && p.saveToLocalStorage(), t
        }
        static decEquip(e) {
            let t = m.user_equip_box,
                i = this.getEquipByID(e);
            if (!i) return !1;
            let s = t.indexOf(i);
            return t.splice(s, 1), this.SAVE_AUTO && p.saveToLocalStorage(), !0
        }
        static addEquipLevel(e, t = 1) {
            let i = this.getEquipByID(e);
            i.lv += t;
            let s = i.iid,
                a = this.getEquipParaTemp(s, 0),
                n = this.getMainParaIndex(a);
            if (n > -1) {
                let e = a[n],
                    t = this.getOneParaByTemp(s, e, i.lv),
                    r = i.bp;
                for (let i = 0; i < r.length; i++) {
                    let s = r[i];
                    if (s.k == e.k) return s.v = t.v, void(this.SAVE_AUTO && p.saveToLocalStorage())
                }
            }
        }
        static changeEquipState(e, t, i = !1) {
            this.getEquipByID(e).st = t, this.SAVE_AUTO && i && p.saveToLocalStorage()
        }
        static getOneParaByTemp(e, t, i) {
            let s, a = t.m;
            return a ? a.indexOf("rely") > -1 && a.indexOf("equip_level") > -1 && (s = this.computOnePara(e, t, t.f1, i), t.f1 && null == s && (s = this.computOnePara(e, t, t.f2, i))) : s = _.getRealInRandom(t.u, t.d), new g(t.k, t.main, s)
        }
        static computOnePara(e, t, i, s) {
            let a = i.split(":"),
                n = a[0],
                r = a[1];
            if ("xls" == n) {
                let e = d.item_json[r];
                for (var o = 0; o < e.length; o++)
                    if (e[o].in == s) return e[o].out
            } else if ("js" == n) {
                if (!this.func_list) return void console.warn(r + " 公式未定义！");
                for (let e = 0; e < this.func_list.length; e++) {
                    let t = this.func_list[e];
                    if (t.name == r) return t(s)
                }
            }
            return null
        }
        static getMainParaIndex(e) {
            for (let t = 0; t < e.length; t++) {
                if (e[t].main) return t
            }
            return -1
        }
        static getEquipParaTemp(e, t) {
            let i = 0 == t ? "f1" : "f2",
                s = new Array;
            return this.paraTempHasClone(e, i, s), s
        }
        static paraTempHasClone(e, t, i) {
            let s = d.getItemByID(e)[t],
                a = JSON.parse(s),
                n = -1;
            for (var r = 0; r < a.length; r++) {
                var o = a[r];
                if ("clone" == o.k) {
                    n = o.u;
                    break
                }
            }
            n > -1 && this.paraTempHasClone(n, t, i);
            for (r = 0; r < a.length; r++) {
                let e = a[r];
                if ("clone" == e.k) continue;
                let t = -1;
                for (let s = 0; s < i.length; s++) {
                    if (i[s].k == e.k) {
                        t = s;
                        break
                    }
                }
                if (-1 == t) {
                    let t = g.createByJson(e);
                    i.push(t)
                } else {
                    let s = g.createByJson(e);
                    i[t] = s
                }
            }
        }
        static getEquipPara(e, t) {
            let i = 0 == t ? "bp" : "sp";
            return this.getEquipByID(e)[i]
        }
        getMainParaValueByEquipLevel(e, t) {
            let i = m.getEquipParaTemp(e, 0),
                s = m.getMainParaIndex(i);
            return m.getOneParaByTemp(e, i[s], t).v
        }
        static createParaList(e, t, i, s, a, n, r, o, l) {
            for (; a > 0;) {
                let h = _.getIntegerInRandom(n.length + o.length - 1, 0),
                    c = h - n.length;
                if (h != r && c != l) {
                    if (h < n.length) {
                        let t = m.getOneParaByTemp(i, n[h], s);
                        e.push(t)
                    } else {
                        h -= n.length;
                        let e = m.getOneParaByTemp(i, o[h], s);
                        t.push(e)
                    }
                    a--
                }
            }
        }
        static getNewEquipByRandomPara(e, t) {
            let i = d.getItemByID(e).f3,
                s = m.getEquipParaTemp(e, 0),
                a = m.getEquipParaTemp(e, 1),
                n = new Array,
                r = m.getMainParaIndex(s);
            if (r > -1) {
                let i = m.getOneParaByTemp(e, s[r], t);
                n.push(i)
            }
            let o = new Array,
                l = m.getMainParaIndex(a);
            if (l > -1) {
                let i = m.getOneParaByTemp(e, a[l], t);
                o.push(i)
            }
            let h = i - n.length - o.length;
            return this.createParaList(n, o, e, t, h, s, r, a, l), m.createEquip(e, n, o, t, 0)
        }
        static resetParaByRandom(e) {
            let t = m.getEquipByID(e),
                i = t.bp,
                s = t.sp,
                a = 0;
            i.forEach(e => {
                if (!e.main) {
                    let t = i.indexOf(e);
                    i.splice(t, 1), a++
                }
            }), s.forEach(e => {
                if (!e.main) {
                    let t = s.indexOf(e);
                    s.splice(t, 1), a++
                }
            });
            let n = t.iid,
                r = t.lv,
                o = new Array,
                l = new Array,
                h = m.getEquipParaTemp(n, 0),
                c = m.getEquipParaTemp(n, 1),
                d = m.getMainParaIndex(h),
                _ = m.getMainParaIndex(c);
            this.createParaList(o, l, n, r, a, h, d, c, _), o.forEach(e => {
                i.push(e.toJson())
            }), l.forEach(e => {
                s.push(e.toJson())
            }), this.SAVE_AUTO && p.saveToLocalStorage()
        }
    }
    m.SAVE_AUTO = !0;
    class u {
        constructor(e, t, i, s, a, n) {
            this.id = e, this.iid = t, this.bp = i, this.sp = s, this.lv = a, this.st = n
        }
        toJson() {
            let e = JSON.stringify(this);
            return JSON.parse(e)
        }
    }
    class g {
        constructor(e, t = !1, i, s, a, n, r, o) {
            this.k = e, this.main = t, null != i && (this.v = i), null != s && (this.m = s), null != a && (this.u = a), null != n && (this.d = n), null != r && (this.f1 = r), null != o && (this.f2 = o)
        }
        static createByJson(e) {
            return new g(e.k, e.main, e.v, e.m, e.u, e.d, e.f1, e.f2)
        }
        toJson() {
            let e = JSON.stringify(this);
            return JSON.parse(e)
        }
    }
    class p {
        constructor(e) {
            e && p.setLibName(e)
        }
        static setLibName(e) {
            this.DB_FILE = e
        }
        static getPath() {
            return p.DB_MODULE_PATH + p.DB_FILE
        }
        static load(e) {
            Laya.loader.create(this.getPath(), Laya.Handler.create(this, function () {
                p.item_json = Laya.loader.getRes(this.getPath());
                let t, i, s, a, r, o, h = Laya.LocalStorage.getJSON("user_json");
                if (h)
                    if (t = h.version, i = h.total_type, s = h.user_item_box, a = h.user_task_box, r = h.user_unlock_box, o = h.user_equip_box, p.item_json.version != t) {
                        for (var c in p.item_json.total_type) null == i[c] && null == i[c] && (i[c] = p.item_json.total_type[c]);
                        p.dataVersionUpdate(p.item_json.user_item_box, s), p.dataVersionUpdate(p.item_json.user_task_box, a), r && p.dataVersionUpdate(p.item_json.user_unlock_box, r), o && p.dataVersionUpdate(p.item_json.user_equip_box, o), p.item_json.total_type = i, p.item_json.user_item_box = s, p.item_json.user_task_box = a, r && (p.item_json.user_unlock_box = r), o && (p.item_json.user_equip_box = o), p.saveToLocalStorage()
                    } else p.item_json.total_type = i, p.item_json.user_item_box = s, p.item_json.user_task_box = a, r && (p.item_json.user_unlock_box = r), o && (p.item_json.user_equip_box = o);
                else p.saveToLocalStorage();
                p.total_type = p.item_json.total_type, d.load(p.item_json), m.load(p.item_json), l.load(p.item_json), n.load(p.item_json), e()
            }))
        }
        static dataVersionUpdate(e, t) {
            for (var i in e[0])
                if (null == t[0][i] || null == t[0][i])
                    for (var s = 0; s < t.length; s++) {
                        var a = e[s][i];
                        t[s][i] = a
                    }
            for (s = 0; s < e.length; s++)
                if (null == t[s] || null == t[s]) {
                    a = e[s];
                    t[s] = a
                }
        }
        static versionCheck() {}
        static saveToLocalStorage() {
            if (p.item_json) {
                var e = JSON.parse("{}");
                e.version = p.item_json.version, e.total_type = p.item_json.total_type, e.user_item_box = p.item_json.user_item_box, e.user_task_box = p.item_json.user_task_box, e.user_unlock_box = p.item_json.user_unlock_box, e.user_equip_box = p.item_json.user_equip_box, Laya.LocalStorage.setJSON("user_json", e)
            }
        }
        static get(e) {
            return p.total_type ? p.total_type[e] : null
        }
        static set(e, t) {
            p.total_type && (p.total_type[e] = t)
        }
        static add(e, t) {
            p.total_type && (p.total_type[e] += t)
            this.saveToLocalStorage();
        }
        static dec(e, t) {
            p.total_type[e] -= t
        }
    }
    p.DB_MODULE_PATH = "res/atlas/dbmodule/", p.DB_FILE = "item_lib.json";
    class f {
        static saveData() {
            p.saveToLocalStorage()
        }
        static setLoginTime() {
            p.set("login_time", Laya.Browser.now())
        }
        static getLoginTime() {
            return p.get("login_time")
        }
        static getLastLeavlTime() {
            return p.get("last_leave_time")
        }
        static setLastLeavlTime() {
            p.set("last_leave_time", Laya.Browser.now())
        }
        static checkIsNewDay() {
            let e = this.getLoginTime();
            return new Date(e).toDateString() !== (new Date).toDateString()
        }
        static getGold() {
            return p.get("gold")
        }
        static addGold(e) {
            p.add("gold", e)
        }
        static decGold(e) {
            p.add("total_gold_cost", e), p.dec("gold", e)
        }
        static setGold(e) {
            p.set("gold", e)
        }
        static getDiamond() {
            return p.get("diamond")
        }
        static addDiamond(e) {
            p.add("diamond", e)
        }
        static decDiamond(e) {
            p.add("total_diamond_cost", e), p.dec("diamond", e)
        }
        static setDiamond(e) {
            p.set("diamond", e)
        }
        static getPlayerSkin() {
            return p.get("player_skin")
        }
        static setPlayerSkin(e) {
            p.set("player_skin", e)
        }
        static getPlayerJewel() {
            return p.get("player_jewel")
        }
        static setPlayerJewel(e) {
            p.set("player_jewel", e)
        }
        static getPlayerGaogen() {
            return p.get("player_gaogen")
        }
        static setPlayerGaogen(e) {
            p.set("player_gaogen", e)
        }
        static getGrade() {
            return p.get("grade")
        }
        static getGradeCyclic() {
            let e = f.getGrade() % 300;
            return 0 == e && (e = 300), e
        }
        static setGrade(e) {
            return p.set("grade", e)
        }
        static addGrade() {
            return p.add("grade", 1)
        }
        static setTicket(e) {
            p.set("ticket", e)
        }
        static getTicket() {
            return p.get("ticket")
        }
        static addTicket() {
            p.add("ticket", 1)
        }
        static decTicket() {
            p.dec("ticket", 1)
        }
    }! function (e) {
        e[e.OTHER = 0] = "OTHER", e[e.QR = 1] = "QR", e[e.RECOMMEND = 2] = "RECOMMEND", e[e.SEARCH = 3] = "SEARCH"
    }(t || (t = {}));
    class y {}
    y.devMode = 3, y.source_type = t.OTHER, y.shake_switch = 1, y.sound_switch = 1, y.moudle_navigate = !0, y.swtich_mistouch = !1, y.is_game_back = !1, y.is_CheckIn = !1, y.isVideo = !1, y.boutCount = 0, y.go_game_time = 0, y.isShowAd = !1, y.tryShoes = null, y.is_try_shoes = !1, y.showShoes = null, y.new_day = !1, y.lotteryNum = 0, y.is_win = !1, y.fashionItem = null, y.challengeItem = null, y.isChallengeItem = null;
    class S {
        static initData(e) {
            console.info(e);
            for (var t = 0; t < e.length; t++) {
                var i = e[t];
                this.setValue(i, i.name)
            }
        }
        static setValue(e, t) {
            this[t] = Number(e.value), console.log("key:", t + "==" + Number(e.value))
        }
        static isShowSideBox() {
            console.log("侧滑卖量 ", y.moudle_navigate)
        }
        static isIos() {}
        static showTryShoes() {
            return f.getGrade() >= S.try_shoes_grade && (f.getGrade() - S.try_shoes_grade) % S.try_shoes_grade_level == 0
        }
        static showStartSkin() {
            return f.getGrade() >= S.start_skin_grade && (f.getGrade() - S.start_skin_grade) % S.start_skin_grade_level == 0
        }
        static showTyeShoes() {
            return f.getGrade() >= S.define_skin_grade && (f.getGrade() - S.define_skin_grade) % S.define_skin_grade_level == 0
        }
    }
    S.physical_power = 10, S.physical_power_time = 3e5, S.physical_power_swtich = 0, S.add_physical_num = 2, S.receiving_button = 1, S.bannerMove = 1500, S.buttonMove = 2e3, S.pub_side_box_grade_ios = 1, S.game_banner = 1, S.gaming_banner = 0, S.install_shortcut = 1, S.show_shortcut = 0, S.show_quick_click = 0, S.show_quick_click_loading = 0, S.home_buy_banner = 0, S.show_grid = 0, S.show_custom = 0, S.advertisement = 0, S.advertisement_game = 0, S.ad_game_show_time = 5e3, S.ad_game_hide_time = 5e3, S.normal_screen = 0, S.fist_screen_time = 1e4, S.interval_screen_time = 6e5, S.delay_screen_time = 700, S.show_game_portalAd = 0, S.try_shoes_grade = 3, S.try_shoes_grade_level = 5, S.start_skin_grade = 3, S.start_skin_grade_level = 4, S.define_skin_grade = 3, S.define_skin_grade_level = 3, S.is_turn_video = 1;
    class b {
        constructor(e) {
            this.m_pOwner = e
        }
        SetCurrentState(e) {
            this.m_pCurrentState = e
        }
        SetGlobalState(e) {
            this.m_pGlobalState = e
        }
        SetPreviousState(e) {
            this.m_pPreviousState = e
        }
        Update() {
            null != this.m_pGlobalState && this.m_pGlobalState.Execute(this.m_pOwner), null != this.m_pCurrentState && this.m_pCurrentState.Execute(this.m_pOwner)
        }
        ChangeState(e) {
            null != e && (null != this.m_pCurrentState &&
                 (this.m_pPreviousState = this.m_pCurrentState, this.m_pCurrentState.Exit(this.m_pOwner)),
                  this.m_pCurrentState = e, this.m_pCurrentState.Enter(this.m_pOwner))
        }
        RevertToPreViousState() {
            this.ChangeState(this.m_pPreviousState)
        }
        getCurrentState() {
            return this.m_pCurrentState
        }
        getPreviousState() {
            return this.m_pPreviousState
        }
        isInState(e) {
            return e.constructor == this.m_pCurrentState.constructor
        }
        isPreState(e) {
            return e.constructor == this.m_pPreviousState.constructor
        }
    }
    class E {
        constructor() {
            E.instance = this
        }
        Enter(e) {
            console.log("StateCameraIdle"), e.camera.useOcclusionCulling = !0, e.camera.fieldOfView = 60, e.camera.transform.position = e.idle_dpos, e.camera.transform.rotationEuler = e.idle_ro
        }
        Execute(e) {}
        Exit(e) {}
    }
    new E;
    class A {
        constructor() {
            A.instance = this
        }
        Enter(e) {
            console.log("StateCameraNormalRunning")
        }
        Execute(e) {
            e.transformToRunning()
        }
        Exit(e) {}
    }
    new A;
    class L {
        constructor() {
            L.instance = this
        }
        Enter(e) {
            console.log("StateCameraWinSuper"), e.stime = e.getNow()
        }
        Execute(e) {
            e.transformToWinSuper()
        }
        Exit(e) {}
    }
    new L;
    class C {
        static range(e, t, i) {
            var s = e > t ? t : e;
            return s = e < i ? i : s
        }
        static radSort(e) {
            return e = (e = e > Math.PI ? e - 2 * Math.PI : e) < -Math.PI ? e + 2 * Math.PI : e
        }
        static degSort(e) {
            return e = (e = e > 180 ? e - 360 : e) < -180 ? e + 360 : e
        }
        static degToRad(e) {
            return e * Math.PI / 180
        }
        static radToDeg(e) {
            return 180 * e / Math.PI
        }
        static Vec3Abs(e) {
            e.x = Math.abs(e.x), e.y = Math.abs(e.y), e.z = Math.abs(e.z)
        }
        static axisLerp(e, t, i) {
            return e * (1 - i) + t * i
        }
        static Vec3Lerp(e, t, i, s) {
            s.x = this.axisLerp(e.x, t.x, i.x), s.y = this.axisLerp(e.y, t.y, i.y), s.z = this.axisLerp(e.z, t.z, i.z)
        }
        static axisLerpByDmax(e, t, i, s) {
            var a = e * (1 - i) + t * i - e;
            return e + (a = this.range(a, s, -s))
        }
        static Vec3LerpByDmax(e, t, i, s, a) {
            a.x = this.axisLerpByDmax(e.x, t.x, i.x, s.x), a.y = this.axisLerpByDmax(e.y, t.y, i.y, s.y), a.z = this.axisLerpByDmax(e.z, t.z, i.z, s.z)
        }
        static axisLerpByDmin(e, t, i, s) {
            var a = e * (1 - i) + t * i,
                n = a - e;
            return Math.abs(n) < s ? Math.abs(t - e) < s ? t : e > t ? e - s : e + s : a
        }
        static Vec3LerpByDmin(e, t, i, s, a) {
            a.x = this.axisLerpByDmin(e.x, t.x, i.x, s.x), a.y = this.axisLerpByDmin(e.y, t.y, i.y, s.y), a.z = this.axisLerpByDmin(e.z, t.z, i.z, s.z)
        }
        static angleLerp(e, t, i) {
            var s = 0;
            return s = (s = (s = Math.abs(e - t) < 180 ? e * (1 - i) + t * i : e > t ? (e - 360) * (1 - i) + t * i : e * (1 - i) + (t - 360) * i) < -180 ? s + 360 : s) > 180 ? s - 360 : s
        }
        static reVec3Lerp(e, t, i, s) {
            s.x = this.angleLerp(e.x, t.x, i.x), s.y = this.angleLerp(e.y, t.y, i.y), s.z = this.angleLerp(e.z, t.z, i.z)
        }
        static angleLerpByDmax(e, t, i, s) {
            var a = 0;
            Math.abs(e - t) < 180 || (e > t ? e -= 360 : t -= 360);
            var n = e * (1 - i) + t * i,
                r = this.degSort(n - e);
            return a = e + (r = this.range(r, s, -s)), a = this.degSort(a)
        }
        static reVec3LerpByDmax(e, t, i, s, a) {
            a.x = this.angleLerpByDmax(e.x, t.x, i.x, s.x), a.y = this.angleLerpByDmax(e.y, t.y, i.y, s.y), a.z = this.angleLerpByDmax(e.z, t.z, i.z, s.z)
        }
        static angleLerpByDmin(e, t, i, s) {
            var a = 0;
            Math.abs(e - t) < 180 || (e > t ? e -= 360 : t -= 360);
            var n = e * (1 - i) + t * i,
                r = this.degSort(n - e);
            return a = Math.abs(r) < s ? Math.abs(this.degSort(t - e)) < s ? t : e > t ? e - s : e + s : n, a = this.degSort(a)
        }
        static reVec3LerpByDmin(e, t, i, s, a) {
            a.x = this.angleLerpByDmin(e.x, t.x, i.x, s.x), a.y = this.angleLerpByDmin(e.y, t.y, i.y, s.y), a.z = this.angleLerpByDmin(e.z, t.z, i.z, s.z)
        }
        static radLerpByDmax(e, t, i, s) {
            var a = 0;
            Math.abs(e - t) < Math.PI || (e > t ? e -= 2 * Math.PI : t -= 2 * Math.PI);
            var n = e * (1 - i) + t * i,
                r = this.radSort(n - e);
            return a = e + (r = this.range(r, s, -s)), a = this.radSort(a)
        }
        static axisCloseTo(e, t, i) {
            return Math.abs(e - t) > i ? e > t ? e - i : e + i : t
        }
        static Vec3CloseTo(e, t, i, s) {
            s.x = this.axisCloseTo(e.x, t.x, i.x), s.y = this.axisCloseTo(e.y, t.y, i.y), s.z = this.axisCloseTo(e.z, t.z, i.z)
        }
        static angleCloseTo(e, t, i) {
            var s = 0;
            return s = (s = (s = Math.abs(e - t) < 180 ? this.axisCloseTo(e, t, i) : e > t ? this.axisCloseTo(e - 360, t, i) : this.axisCloseTo(e, t - 360, i)) < -180 ? s + 360 : s) > 180 ? s - 360 : s
        }
        static reVec3CloseTo(e, t, i, s) {
            s.x = this.angleCloseTo(e.x, t.x, i.x), s.y = this.angleCloseTo(e.y, t.y, i.y), s.z = this.angleCloseTo(e.z, t.z, i.z)
        }
        static angleSubtract(e, t) {
            return this.degSort(e - t)
        }
        static reVec3Subtract(e, t, i) {
            i.x = this.angleSubtract(e.x, t.x), i.y = this.angleSubtract(e.y, t.y), i.z = this.angleSubtract(e.z, t.z)
        }
    }
    class v {
        static WorldToScreen2(e, t) {
            var i = this.InverseTransformPoint(e.transform, t).z,
                s = new Laya.Vector3;
            return e.viewport.project(t, e.projectionViewMatrix, s), new Laya.Vector3(s.x / a.getScaleRate(), s.y / a.getScaleRate(), i)
        }
        static ScreenToWorld(e, t) {
            var i = .5 * e.fieldOfView * Math.PI / 180;
            let s = t.z * Math.tan(i),
                a = s * e.aspectRatio,
                n = this.GetLowerLeft(e.transform, t.z, a, s),
                r = this.GetScreenScale(a, s);
            var o = new Laya.Vector3,
                l = this.InverseTransformPoint(e.transform, n);
            return o = new Laya.Vector3(-t.x / r.x, t.y / r.y, 0), Laya.Vector3.add(l, o, o), o = this.TransformPoint(e.transform, o)
        }
        static GetScreenScale(e, t) {
            var i = new Laya.Vector3;
            return i.x = Laya.stage.width / e / 2, i.y = Laya.stage.height / t / 2, i
        }
        static GetLowerLeft(e, t, i, s) {
            var a = new Laya.Vector3,
                n = new Laya.Vector3;
            e.getRight(n), Laya.Vector3.normalize(n, n);
            var r = new Laya.Vector3(n.x * i, n.y * i, n.z * i);
            Laya.Vector3.add(e.position, r, a);
            var o = new Laya.Vector3;
            e.getUp(o), Laya.Vector3.normalize(o, o);
            var l = new Laya.Vector3(o.x * s, o.y * s, o.z * s);
            Laya.Vector3.subtract(a, l, a);
            var h = new Laya.Vector3;
            e.getForward(h), Laya.Vector3.normalize(h, h);
            var c = new Laya.Vector3(h.x * t, h.y * t, h.z * t);
            return Laya.Vector3.subtract(a, c, a), a
        }
        static InverseTransformPoint(e, t) {
            var i = new Laya.Vector3;
            e.getRight(i);
            var s = new Laya.Vector3;
            e.getUp(s);
            var a = new Laya.Vector3;
            e.getForward(a);
            var n = new Laya.Vector3(-a.x, -a.y, -a.z),
                r = this.ProjectDistance(t, e.position, i),
                o = this.ProjectDistance(t, e.position, s),
                l = this.ProjectDistance(t, e.position, n);
            return new Laya.Vector3(r, o, l)
        }
        static TransformPoint(e, t) {
            var i = new Laya.Vector3;
            return Laya.Vector3.transformQuat(t, e.rotation, i), Laya.Vector3.add(i, e.position, i), i
        }
        static ProjectDistance(e, t, i) {
            var s = new Laya.Vector3;
            Laya.Vector3.subtract(e, t, s);
            var a = this.Angle2(s, i) * Math.PI / 180,
                n = Laya.Vector3.distance(e, t);
            return n *= Math.cos(a)
        }
        static Angle2(e, t) {
            var i = e.x * t.x + e.y * t.y + e.z * t.z,
                s = Math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z),
                a = Math.sqrt(t.x * t.x + t.y * t.y + t.z * t.z),
                n = 0;
            if (s * a != 0) n = i / (s * a);
            return n < -1 && (n = -1), n > 1 && (n = 1), 180 * Math.acos(n) / Math.PI
        }
        static unityToLayaPos(e) {
            return new Laya.Vector3(-e.x, e.y, e.z)
        }
        static unityToLayaRE(e) {
            return new Laya.Vector3(-e.x, 180 - e.y, e.z)
        }
        static distance2DXZ(e, t) {
            return Math.sqrt((e.x - t.x) * (e.x - t.x) + (e.z - t.z) * (e.z - t.z))
        }
        static towardsRey2DXZ(e, t) {
            return 180 * Math.atan2(t.x - e.x, t.z - e.z) / Math.PI
        }
        static isInParRect(e, t, i) {
            return !(i.x <= e.x) && (!(i.x >= t.x) && (!(i.z >= e.z) && !(i.z <= t.z)))
        }
        static isInRect(e, t, i, s, a) {
            if (Math.abs(e.x - i.x) > .001) {
                let t = s.x - i.x,
                    n = s.z - i.z,
                    r = Math.sqrt(t * t + n * n),
                    o = t / r,
                    l = n / r,
                    h = o * a.x + l * a.z,
                    c = -l * a.x + o * a.z,
                    d = e.clone(),
                    _ = s.clone();
                return d.x = o * e.x + l * e.z, d.z = -l * e.x + o * e.z, _.x = o * s.x + l * s.z, _.z = -l * s.x + o * s.z, this.isInParRect(d, _, new Laya.Vector3(h, 0, c))
            }
            return this.isInParRect(e, s, a)
        }
        static PointRotate(e, t, i) {
            let s = (e.x - t.x) * Math.cos(i) - (e.z - t.z) * Math.sin(i) + t.x,
                a = (e.x - t.x) * Math.sin(i) + (e.z - t.z) * Math.cos(i) + t.z;
            e.x = s, e.z = a
        }
        static getStandardBoxPoints(e) {
            let t = new Array,
                i = e.transform.position,
                s = e.transform.localScale,
                a = C.degToRad(e.transform.rotationEuler.y),
                n = new Laya.Vector3(i.x - .5 * s.x, 0, i.z + .5 * s.z);
            this.PointRotate(n, i, a);
            let r = new Laya.Vector3(i.x + .5 * s.x, 0, i.z + .5 * s.z);
            this.PointRotate(r, i, a);
            let o = new Laya.Vector3(i.x - .5 * s.x, 0, i.z - .5 * s.z);
            this.PointRotate(o, i, a);
            let l = new Laya.Vector3(i.x + .5 * s.x, 0, i.z - .5 * s.z);
            return this.PointRotate(l, i, a), t.push(n), t.push(r), t.push(o), t.push(l), t
        }
        static cloneLocalTransform(e, t) {
            t.localPosition = e.localPosition.clone(), t.localRotationEuler = e.localRotationEuler.clone(), t.localScale = e.localScale.clone()
        }
        static resetLocalTransform(e) {
            e.localPosition = new Laya.Vector3(0, 0, 0), e.localRotationEuler = new Laya.Vector3(0, 0, 0), e.localScale = new Laya.Vector3(1, 1, 1)
        }
        static addChild(e, t) {
            let i = t.transform.getWorldLossyScale().clone();
            e.addChild(t), t.transform.localPosition = new Laya.Vector3(0, 0, 0), t.transform.localRotationEuler = new Laya.Vector3(0, 0, 0), t.transform.setWorldLossyScale(i)
        }
        static addChildToScene3D(e, t) {
            let i = t.transform.getWorldLossyScale().clone();
            e.addChild(t), t.transform.setWorldLossyScale(i)
        }
        static addChildToScene3D2(e, t) {
            let i = t.transform.position.clone(),
                s = t.transform.rotationEuler.clone(),
                a = t.transform.getWorldLossyScale().clone();
            e.addChild(t), t.transform.position = i, t.transform.rotationEuler = s, t.transform.setWorldLossyScale(a)
        }
    }
    class w {
        constructor(e) {
            this.ch = null, this.loadingTimeoutId = null, this.ch = e
        }
        login(e = null) {}
        getSystem() {}
        getLaunchOptions() {}
        onShowAlways() {}
        onShow(e = null) {}
        onHide(e = null) {}
        showLoading(e = 3e3, t = null) {}
        hideLoading() {}
        showToast(e, t = "none", i = 1e3) {}
        showModal(e, t, i = !0, s = null) {}
        vibrateShort() {}
        vibrateLong() {}
    }
    class I {}
    I.systemInfo = null, I.appName = "", I.screenWidth = Laya.Browser.clientWidth, I.screenHeight = Laya.Browser.clientHeight, I.launchOption = null, I.sourceScene = null, I.sourceAppId = null, I.videoEnable = !1;
    class T {
        constructor() {}
        static shareDataLoad(e) {
            this.shareData && e && e()
        }
        static getOneShareData() {
            return null
        }
        static isCanShareToday() {
            if (p.item_json) {
                var e = p.get(this.KEY_SHARE_LAST_TIME);
                return 0 == e || null == e || (this.isToday(e) ? p.get(this.KEY_SHARE_NUM_TODAY) < this.LIMIT_SHARE_PRE_DAY : (p.set(this.KEY_SHARE_NUM_TODAY, 0), !0))
            }
            return console.warn("TotalType 未初始化"), !1
        }
        static addShareToday() {
            if (p.item_json) {
                var e = p.get(this.KEY_SHARE_NUM_TODAY);
                console.warn("addShareToday:" + e), null == e ? p.set(this.KEY_SHARE_NUM_TODAY, 1) : p.add(this.KEY_SHARE_NUM_TODAY, 1), p.set(this.KEY_SHARE_LAST_TIME, (new Date).getTime())
            } else console.warn("TotalType 未初始化")
        }
        static isToday(e) {
            return new Date(e).toDateString() === (new Date).toDateString()
        }
    }
    T.DB_PATH = "res/share/", T.KEY_SHARE_NUM_TODAY = "share_num_today", T.KEY_SHARE_LAST_TIME = "share_last_time", T.LIMIT_SHARE_PRE_DAY = 5;
    class x extends w {
        constructor(e) {
            super(e), this.videoAd = null, this.videoId = "adunit-de779ebec99dd6d6", this.bannerAd = null, this.banIndex = 0, this.bannerId = ["adunit-98f48e2b2e568d65", "adunit-96e4d8d38fc3c1cc", "adunit-9a089675fb996c18"], this.insertAd = null, this.insertId = "adunit-b385256b000318f5", this.customAds = [], this.customId = ["adunit-fb977ea4595169ed", "adunit-31179f06c4d0aaba", "adunit-754c33c32b1724e9", "adunit-754c33c32b1724e9"], this.gridAds = [], this.gridId = ["adunit-fa6a909e7c49a724", "adunit-110b61a35691213c", "adunit-8bb5d8703bb2adda"], this.share_start_time = 0, this.share_end_time = 0, this.share_interval_time = 3100, this.isBannerShow = !1, this.videoCallback = null, this.getSystem(), this.getLaunchOptions(), this.onShowAlways(), this.checkUpdate(), this.onHide()
        }
        createVideoAd() {
            if (this.ch) {
                this.videoAd = this.ch.createRewardedVideoAd({
                    adUnitId: this.videoId
                }), this.videoAd.onLoad(() => {
                    console.log("视频创建成功"), I.videoEnable = !0, this.videoAd.offLoad()
                }), this.videoAd.onError(e => {
                    console.log("视频创建错误：", e), I.videoEnable = !1
                }), this.videoAd.load();
                let e = e => {
                    e && e.isEnded ? (console.info("视频观看成功"), this.videoCallback && this.videoCallback(!0)) : (console.log("视频观看失败"), this.videoCallback && this.videoCallback(!1))
                };
                this.videoAd.onClose(e)
            }
        }
        showVideoAd(e = null) {
            // this.ch && this.videoAd ? (this.videoCallback = e, this.videoAd.show().catch(t => {
            //     this.showToast("暂无广告，请稍后再试"), e && e(!1)
            // })) : U.mainCH.showToast("暂无广告")
            window.startVideo=true
            console.log("Sy --- 视频");
            VkApp.showRewarded(() => {
               e && e(!1)
               window.startVideo=false
            },()=>{
                window.startVideo=false
            })
            return;
        }
        createBannerAd() {
            if (this.ch) {
                let e = this.refreshBanId();
                this.bannerAd = this.ch.createBannerAd({
                    adUnitId: e,
                    adIntervals: 30,
                    style: {
                        left: I.screenWidth / 2 - 150,
                        top: I.screenHeight - 105,
                        width: 300
                    }
                }), this.bannerAd.onLoad(() => {
                    console.log("banner创建成功 id=", e), this.bannerAd.offLoad()
                }), this.bannerAd.onResize(() => {
                    console.log("Resize", this.bannerAd), this.bannerAd.style.left = (I.screenWidth - this.bannerAd.style.realWidth) / 2, this.bannerAd.offResize()
                }), this.bannerAd.onError(e => {
                    console.log("创建banner失败: ", e)
                }), this.isBannerShow ? this.showBannerAd() : this.hideBannerAd()
            }
        }
        refreshBanId() {
            return this.banIndex++, this.banIndex > this.bannerId.length - 1 && (this.banIndex = 0), this.bannerId[this.banIndex]
        }
        destroyBannerAd() {
            this.bannerAd && (console.log("销毁 banner"), this.bannerAd.destroy(), this.bannerAd = null)
        }
        resetBannerAd() {
            this.ch && (console.log("刷新 banner"), this.destroyBannerAd(), this.createBannerAd())
        }
        showBannerAd() {
            this.isBannerShow = !0, this.ch && this.bannerAd && S.game_banner && (console.log("显示 banner"), this.bannerAd.show())
        }
        hideBannerAd() {
            this.isBannerShow = !1, this.ch && this.bannerAd && (console.log("隐藏 banner"), this.bannerAd.hide())
        }
        createInterstitialAd() {
            this.ch && (this.insertAd = this.ch.createInterstitialAd({
                adUnitId: this.insertId
            }), this.insertAd.onLoad(() => {
                console.log("插屏广告加载完毕")
            }), this.insertAd.onError(e => {
                console.log("插屏广告错误", e)
            }))
        }
        showInterstitialAd(e = null) {
            if (console.log("显示插屏广告"), this.ch && this.insertAd) {
                e && this.insertAd.onClose(() => {
                    console.log("插屏广告关闭"), this.insertAd.offClose(), e && e()
                }), this.insertAd.show().catch(e => {
                    console.log("创建插屏广告失败"), console.log(`errCode:${e.errMsg},errMsg:${e.errCode}`)
                })
            }
        }
        createCustomAd(e, t, i, s = 0) {
            if (this.ch) {
                if (Laya.Browser.height / Laya.Browser.width < .5 && (e += s), I.systemInfo.SDKVersion < "2.11.1") return;
                let a = this.ch.createCustomAd({
                    adUnitId: this.customId[i],
                    adIntervals: 30,
                    style: {
                        left: e,
                        top: t,
                        fixed: !1
                    }
                });
                a.onLoad(() => {
                    console.info("原生模板广告创建成功")
                }), a.onError(e => {
                    console.info("原生模板广告错误" + this.customId[i], e)
                }), this.customAds.push(a)
            }
        }
        showCustomAd(e) {
            this.ch && this.customAds[e] && S.show_custom && this.customAds[e].show()
        }
        hideCustomAd(e = null) {
            if (console.log("隐藏原生模板广告"), this.ch && this.customAds && this.customAds.length > 0)
                for (let e = 0; e < this.customAds.length; e++) this.customAds[e] && this.customAds[e].hide()
        }
        createGridAd(e = 0, t = I.screenHeight - 100, i, s = 5) {
            if (this.ch) {
                if (I.systemInfo.SDKVersion < "2.10.2") return;
                console.info("创建格子广告");
                var a = this.ch.createGridAd({
                    adUnitId: this.gridId[i],
                    adIntervals: 30,
                    style: {
                        top: t,
                        left: e,
                        width: 100,
                        height: 100
                    },
                    gridCount: s
                });
                a.onLoad(() => {
                    console.info("格子广告创建成功")
                }), a.onError(e => {
                    console.info("格子广告创建错误", e)
                }), a.onResize(e => {
                    console.info("格子广告大小：", e)
                }), this.gridAds.push(a)
            }
        }
        showGridAd(e) {
            console.info("显示格子广告"), this.ch && this.gridAds[e] && S.show_grid && this.gridAds[e].show()
        }
        hideGridAd(e = null) {
            if (console.log("隐藏格子广告"), this.ch && this.gridAds && this.gridAds.length > 0)
                for (let e = 0; e < this.gridAds.length; e++) this.gridAds[e] && this.gridAds[e].hide()
        }
        showShareMenu() {
            this.ch && (this.setShareAppMessage(), this.ch.showShareMenu({
                withShareTicket: !1
            }), console.log("显示转发按钮"))
        }
        setShareAppMessage() {
            this.ch && (console.log("设置转发信息"), T.shareDataLoad(() => {
                this.ch.onShareAppMessage(() => {
                    let e = T.getOneShareData();
                    return console.log("setShareAppMessage sdb: ", e), {
                        title: e.title,
                        imageUrl: e.img_url,
                        success: e => {},
                        fail: e => {}
                    }
                })
            }))
        }
        share(e = null) {
            if (this.ch) {
                if (!T.isCanShareToday()) return void this.showToast("今日奖励次数已达上限");
                this.share_start_time = Laya.Browser.now();
                let t = t => {
                    this.share_end_time = Laya.Browser.now(), this.share_end_time - this.share_start_time >= this.share_interval_time ? (e && e(!0), T.addShareToday()) : e && e(!1)
                };
                this.onShow(t), T.shareDataLoad(() => {
                    let e = T.getOneShareData(),
                        t = Laya.Browser.now() + "" + ~~(1e4 * (.1 + Math.random() / 2));
                    this.ch.shareAppMessage({
                        title: e.title,
                        imageUrl: e.img_url,
                        query: "&sn=" + t + "&share_id=" + e.id
                    })
                })
            }
        }
        checkUpdate() {
            if (this.ch) {
                let e = this.ch.getUpdateManager();
                e.onCheckForUpdate(e => {
                    console.log("是否有新版本:", e.hasUpdate)
                }), e.onUpdateFailed(() => {
                    this.showToast("新版本下载失败")
                }), e.onUpdateReady(() => {
                    this.showModal("更新提示", "新版本已经准备好，是否重启应用？", !0, t => {
                        t && e.applyUpdate()
                    })
                })
            }
        }
        gotoOther(e, t, i, s = null) {
            this.ch && t && this.ch.navigateToMiniProgram({
                appId: t,
                path: i,
                success(e) {
                    console.log("打开成功: appid = ", t), s && s(!0)
                },
                fail(e) {
                    console.log("打开失败: appid = ", t), s && s(!1)
                }
            })
        }
        setKeepScreenOn(e = !0) {
            this.ch && this.ch.setKeepScreenOn({
                keepScreenOn: e,
                success(e) {
                    console.log("屏幕常亮开启")
                },
                fail(e) {
                    console.log("setKeepScreenOn调用失败")
                }
            })
        }
    }
    class k extends w {
        constructor(e) {
            super(e), this.videoAd = null, this.videoId = "2c473cc690cba1d1e8745d3338cbd153", this.bannerAd = null, this.banIndex = 0, this.bannerId = ["0caed23b1bf34f163ab7d0720cb87895"], this.insertAd = null, this.insertId = "4f48ec0d49a60bafd777f050e2c20636", this.boxAd = null, this.boxAdId = "5e0e7c3c816cef6c182f6f6c85cf857d", this.share_start_time = 0, this.share_end_time = 0, this.share_interval_time = 3e3, this.videoCallback = null, this.getSystem(), this.getLaunchOptions(), this.onShowAlways(), this.createBannerAd(), this.createVideoAd(), this.createInterstitialAd(), this.setShareAppMessage(), this.createAppBox(), this.checkUpdate()
        }
        createVideoAd() {
            if (this.ch) {
                this.videoAd = this.ch.createRewardedVideoAd({
                    adUnitId: this.videoId
                }), this.videoAd.onLoad(() => {
                    console.log("视频创建成功"), I.videoEnable = !0, this.videoAd.offLoad()
                }), this.videoAd.onError(e => {
                    console.log("视频创建错误：", e), I.videoEnable = !1
                }), this.videoAd.load();
                let e = e => {
                    e && e.isEnded ? (console.log("视频观看成功"), this.videoCallback && this.videoCallback(!0)) : (console.log("视频观看失败"), this.videoCallback && this.videoCallback(!1)), y.sound_switch || (Laya.SoundManager.muted = !0)
                };
                this.videoAd.onClose(e)
            }
        }
        showVideoAd(e = null) {
            this.ch && this.videoAd && (this.videoCallback = e, this.videoAd.show().catch(e => {
                this.showToast("获取视频失败")
            }))
        }
        createBannerAd() {
            if (this.ch) {
                let e = this.refreshBanId();
                this.bannerAd = this.ch.createBannerAd({
                    adUnitId: e,
                    adIntervals: 30,
                    style: {
                        top: I.screenHeight - 80,
                        left: 0,
                        width: I.screenWidth
                    }
                }), this.bannerAd.onLoad(() => {
                    console.log("banner创建成功 id=", e), this.bannerAd.offLoad()
                }), this.bannerAd.onResize(() => {
                    console.log("Resize", this.bannerAd), this.bannerAd.style.left = (I.screenWidth - this.bannerAd.style.realWidth) / 2, this.bannerAd.style.top = I.screenHeight - this.bannerAd.style.realHeight, this.bannerAd.offResize()
                }), this.bannerAd.onError(e => {
                    console.log("创建banner失败: ", e)
                })
            }
        }
        refreshBanId() {
            return this.banIndex++, this.banIndex > this.bannerId.length - 1 && (this.banIndex = 0), this.bannerId[this.banIndex]
        }
        destroyBannerAd() {
            this.bannerAd && (console.log("销毁 banner"), this.bannerAd.destroy(), this.bannerAd = null)
        }
        resetBannerAd() {
            this.ch && (console.log("刷新 banner"), this.destroyBannerAd(), this.createBannerAd(), this.bannerAd.show())
        }
        showBannerAd() {
            this.ch && this.bannerAd && (console.log("显示 banner"), this.bannerAd.show())
        }
        hideBannerAd() {
            console.log("隐藏 banner"), this.ch && this.bannerAd && this.bannerAd.hide()
        }
        createInterstitialAd() {
            this.ch && (this.insertAd = this.ch.createInterstitialAd({
                adUnitId: this.insertId
            }), this.insertAd.onLoad(() => {
                console.log("插屏广告加载完毕"), this.insertAd.offLoad()
            }), this.insertAd.onError(e => {
                console.log("插屏广告错误", e), this.insertAd.offError()
            }))
        }
        showInterstitialAd(e = null) {
            if (console.log("显示插屏广告"), this.ch && this.insertAd) {
                e && (this.insertAd.offClose(), this.insertAd.onClose(() => {
                    console.log("插屏广告关闭"), this.insertAd.offClose(), e && e()
                })), this.insertAd.show().catch(e => {
                    console.log("创建插屏广告失败"), console.log(`errCode:${e.errMsg},errMsg:${e.errCode}`)
                })
            }
        }
        showShareMenu() {
            this.ch && (this.setShareAppMessage(), this.ch.showShareMenu({
                withShareTicket: !1
            }), console.log("显示转发按钮"))
        }
        setShareAppMessage() {
            this.ch && (console.log("设置转发信息"), T.shareDataLoad(() => {
                this.ch.onShareAppMessage(() => {
                    let e = T.getOneShareData();
                    return console.log("setShareAppMessage sdb: ", e), {
                        title: e.title,
                        imageUrl: e.img_url,
                        success: e => {},
                        fail: e => {}
                    }
                })
            }))
        }
        share(e = null) {
            if (this.ch) {
                if (!T.isCanShareToday()) return void this.showToast("今日奖励次数已达上限");
                this.share_start_time = Laya.Browser.now();
                let t = t => {
                    this.share_end_time = Laya.Browser.now(), this.share_end_time - this.share_start_time >= this.share_interval_time ? (e && e(!0), T.addShareToday()) : e && e(!1)
                };
                this.onShow(t), T.shareDataLoad(() => {
                    let e = T.getOneShareData(),
                        t = Laya.Browser.now() + "" + ~~(1e4 * (.1 + Math.random() / 2));
                    this.ch.shareAppMessage({
                        title: e.title,
                        imageUrl: e.img_url,
                        query: "&sn=" + t + "&share_id=" + e.id
                    })
                })
            }
        }
        gotoOther(e, t, i = null) {
            this.ch && e && this.ch.navigateToMiniProgram({
                appId: e,
                path: t,
                success(t) {
                    console.log("打开成功: appId = ", e), i && i(!0)
                },
                fail(t) {
                    console.log("打开失败: appId = ", e), i && i(!1)
                }
            })
        }
        createAppBox() {
            this.ch && (this.boxAd = this.ch.createAppBox({
                adUnitId: this.boxAdId
            }), this.boxAd.load())
        }
        showAppBox() {
            this.ch && this.boxAd && this.boxAd.show()
        }
        addColorSign(e = null) {
            this.ch && this.ch.addColorSign({
                success(t) {
                    console.log("----subscribeAppMsg----success", t), e && e(!0)
                },
                fail(t) {
                    console.log("----subscribeAppMsg----fail", t), e && e(!0)
                }
            })
        }
        saveAppToDesktop() {
            this.ch && this.ch.saveAppToDesktop()
        }
        subscribeAppMsg() {
            this.ch && this.ch.subscribeAppMsg({
                subscribe: !0,
                success(e) {
                    console.log("----subscribeAppMsg----success", e)
                },
                fail(e) {
                    console.log("----subscribeAppMsg----fail", e)
                }
            })
        }
        checkUpdate() {
            if (this.ch) {
                let e = this.ch.getUpdateManager();
                e.onCheckForUpdate(e => {
                    console.log("是否有新版本:", e.hasUpdate)
                }), e.onUpdateFailed(() => {
                    this.showToast("新版本下载失败")
                }), e.onUpdateReady(() => {
                    this.showModal("更新提示", "新版本已经准备好，是否重启应用？", !0, t => {
                        t && e.applyUpdate()
                    })
                })
            }
        }
    }
    class B extends w {
        constructor(e) {
            super(e), this.videoAd = null, this.videoId = "2rqd5wdjpp40bmff4d", this.bannerAd = null, this.banIndex = 0, this.bannerId = ["d5qmn16ddbf2j3m7ia"], this.insertAd = null, this.insertId = "35e9gsqo2nt1iqvov0", this.btnMoreGame = null, this.gameRecorderManager = null, this.isRecording = !1, this.recordingBeginTime = 0, this.recordingEndTime = 0, this.clipIndexList = [], this.recordResp = null, this.recordTime = 0, this.videoCallback = null, this.getSystem(), this.getLaunchOptions(), this.onShowAlways(), this.getGameRecorderManager(), this.checkUpdate(), this.onHide()
        }
        share(e = null, t = "article", i = {}) {
            if (this.ch) {
                let s = T.getOneShareData(),
                    a = Laya.Browser.now() + "" + ~~(1e4 * (.1 + Math.random() / 2));
                "article" == t ? this.ch.shareAppMessage({
                    title: s.title,
                    imageUrl: s.img_url,
                    query: "&sn=" + a + "&share_id=" + s.id,
                    extra: i,
                    success() {
                        e && e(!0)
                    },
                    fail(t) {
                        e && e(!1)
                    }
                }) : this.ch.shareAppMessage({
                    channel: t,
                    title: s.title,
                    imageUrl: s.img_url,
                    query: "&sn=" + a + "&share_id=" + s.id,
                    extra: i,
                    success() {
                        e && e(!0)
                    },
                    fail(t) {
                        e && e(!1)
                    }
                })
            }
        }
        createVideoAd() {
            if (this.ch) {
                this.videoAd = this.ch.createRewardedVideoAd({
                    adUnitId: this.videoId
                }), this.videoAd.onLoad(() => {
                    I.videoEnable = !0
                }), this.videoAd.onError(e => {
                    I.videoEnable = !1
                }), this.videoAd.load();
                let e = e => {
                    e && e.isEnded ? this.videoCallback && this.videoCallback(!0) : this.videoCallback && this.videoCallback(!1)
                };
                this.videoAd.onClose(e)
            }
        }
        showVideoAd(e = null) {
            this.ch && this.videoAd && (this.videoCallback = e, this.videoAd.show().catch(e => {
                this.showToast("暂无视频，请稍后再试"), this.videoAd.load()
            }))
        }
        createBannerAd() {
            if (this.ch) {
                let e = this.refreshBanId(),
                    t = 150;
                t = Laya.Browser.width / Laya.Browser.height < .5 ? 250 : 150, this.bannerAd = this.ch.createBannerAd({
                    adUnitId: e,
                    style: {
                        width: t,
                        top: I.screenHeight - t / 16 * 9
                    }
                }), this.bannerAd.onLoad(() => {
                    this.hideBannerAd()
                }), this.bannerAd.onError(e => {}), this.bannerAd.onResize(e => {
                    this.bannerAd.style.top = I.screenHeight - e.height, this.bannerAd.style.left = (I.screenWidth - e.width) / 2
                })
            }
        }
        refreshBanId() {
            return this.banIndex++, this.banIndex > this.bannerId.length - 1 && (this.banIndex = 0), this.bannerId[this.banIndex]
        }
        destroyBannerAd() {
            this.bannerAd && (this.bannerAd.destroy(), this.bannerAd = null)
        }
        resetBannerAd() {
            this.ch && (this.destroyBannerAd(), this.createBannerAd(), this.showBannerAd())
        }
        showBannerAd() {
            this.ch && this.bannerAd && S.game_banner && this.bannerAd.show()
        }
        hideBannerAd() {
            this.bannerAd && this.bannerAd.hide()
        }
        createInterstitialAd() {
            const e = "Toutiao" === I.appName;
            this.ch && e && (this.insertAd = this.ch.createInterstitialAd({
                adUnitId: this.insertId
            }), this.insertAd.onLoad(() => {
                this.insertAd.offLoad()
            }), this.insertAd.onError(e => {
                this.insertAd.offError()
            }))
        }
        showInterstitialAd(e) {
            if (this.ch && this.insertAd) {
                e && this.insertAd.onClose(() => {
                    this.insertAd.offClose(), e()
                }), this.insertAd.show().catch(e => {})
            } else e && e()
        }
        getGameRecorderManager() {
            this.ch && (this.gameRecorderManager = this.ch.getGameRecorderManager(), this.gameRecorderManager.onError(e => {}), this.gameRecorderManager.onInterruptionBegin(e => {
                this.showToast("录屏中断")
            }), this.gameRecorderManager.onInterruptionEnd(e => {
                this.showToast("录屏中断")
            }), this.gameRecorderManager.onStart(e => {
                this.isRecording = !0, this.recordingBeginTime = (new Date).getTime()
            }), this.gameRecorderManager.onStop(e => {
                this.recordResp = e, this.isRecording = !1, this.recordingEndTime = (new Date).getTime(), this.recordClip()
            }))
        }
        startGameRecorderManager() {
            this.ch && this.gameRecorderManager.start({
                duration: 300
            })
        }
        stopGameRecorderManager() {
            this.ch && this.gameRecorderManager.stop()
        }
        recordClip() {
            this.ch && (this.recordTime = Math.floor((this.recordingEndTime - this.recordingBeginTime) / 1e3), this.gameRecorderManager.recordClip({
                timeRange: [this.recordTime, 0]
            }))
        }
        recordShare(e = null) {
            this.ch && (this.recordTime > 3 ? this.share(t => {
                e && e(t)
            }, "video", {
                videoPath: this.recordResp.videoPath
            }) : this.showToast("录屏时间不足"))
        }
        createBtnMoreGame(e, t, i) {
            if (this.ch) {
                let s = Laya.Browser.width / 640,
                    a = 450;
                a = Laya.Browser.width / Laya.Browser.height < .5 ? 550 : 450, this.btnMoreGame = this.ch.createMoreGamesButton({
                    type: "image",
                    image: e,
                    style: {
                        left: 0,
                        top: a * s / Laya.Browser.pixelRatio,
                        width: t * s / Laya.Browser.pixelRatio,
                        height: i * s / Laya.Browser.pixelRatio,
                        lineHeight: 0,
                        backgroundColor: "#00000000",
                        textColor: "#00000000",
                        textAlign: "center",
                        fontSize: 16,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: "#00000000"
                    },
                    appLaunchOptions: [],
                    onNavigateToMiniGame(e) {}
                }), this.btnMoreGame.onTap(() => {})
            }
        }
        showBtnMoreGame() {
            this.ch && this.btnMoreGame && this.btnMoreGame.show()
        }
        showMoreGamesModal() {}
        hideBtnMoreGame() {
            this.ch && this.btnMoreGame && this.btnMoreGame.hide()
        }
        checkUpdate() {
            if (this.ch) {
                let e = this.ch.getUpdateManager();
                e.onCheckForUpdate(e => {}), e.onUpdateFailed(() => {
                    this.showToast("新版本下载失败")
                }), e.onUpdateReady(() => {
                    this.showModal("更新提示", "新版本已经准备好，是否重启应用？", !0, t => {
                        t && e.applyUpdate()
                    })
                })
            }
        }
    }
    class R extends w {
        constructor(e) {
            super(e), this.videoAd = null, this.videoId = "", this.bannerAd = null, this.banIndex = 0, this.bannerId = [""], this.insertAd = null, this.insertId = ""
        }
        createVideoAd() {
            throw new Error("Method not implemented.")
        }
        showVideoAd() {
            throw new Error("Method not implemented.")
        }
        createBannerAd() {
            throw new Error("Method not implemented.")
        }
        destroyBannerAd() {
            throw new Error("Method not implemented.")
        }
        showBannerAd() {
            throw new Error("Method not implemented.")
        }
        hideBannerAd() {
            throw new Error("Method not implemented.")
        }
    }
    class M extends w {
        constructor(e) {
            super(e), this.videoAd = null, this.videoId = "291246", this.bannerAd = null, this.banIndex = 0, this.bannerId = ["291626"], this.insertAd = null, this.insertId = "188160", this.nativeAd = null, this.nativeId = "291247", this.gameBannerAd = null, this.gameBannerAdId = "283596", this.gamePortalAd = null, this.gamePortalAdId = "291254", this.isShowToast = !1, this.isShortcut = !0, this.videoCallback = null, this.create_shortcut_time = 0, this.interstitial_time = 0, this.nativeId_time = 0, this.isCallback = !1, this.getSystem(), this.getLaunchOptions(), this.onShowAlways(), this.createBannerAd(), this.createVideoAd(), this.createNativeAd(), this.onHide(), this.reportMonitor(), this.createGamePortalAd()
        }
        createVideoAd() {
            if (this.ch) {
                console.log("点击创建视频", this.ch), this.videoAd = this.ch.createRewardedVideoAd({
                    adUnitId: this.videoId
                }), I.videoEnable = !0, this.videoAd.onLoad(() => {
                    console.log("励视频加载成功"), I.videoEnable = !0, this.videoAd.show()
                }), this.videoAd.onError(e => {
                    console.log("视频创建错误：", e), I.videoEnable = !1, this.isShowToast && this.showToast("暂无广告，请稍后再试", "none", 1e3)
                });
                let e = e => {
                    e && e.isEnded ? (console.log("视频观看成功"), this.isCallback || (this.isCallback = !0, this.videoCallback && this.videoCallback(!0))) : console.log("视频观看失败")
                };
                this.videoAd.onClose(e)
            }
        }
        showVideoAd(e = null) {
            this.isShowToast = !0, this.isCallback = !1, console.log("点击观看视频", I.videoEnable), this.ch && this.videoAd ? (this.videoCallback = e, this.isShortcut = !1, this.videoAd.load()) : this.showToast("暂无广告，请稍后再试", "none", 1e3)
        }
        createBannerAd() {
            if (this.ch) {
                let e = this.refreshBanId();
                this.bannerAd = this.ch.createBannerAd({
                    adUnitId: e
                }), this.bannerAd.onLoad(() => {
                    console.log("banner创建成功 id=", e)
                }), this.bannerAd.onResize(() => {
                    console.log("banner onresize")
                }), this.bannerAd.onError(e => {
                    console.log("创建banner失败: ", e)
                })
            }
        }
        refreshBanId() {
            return this.banIndex++, this.banIndex > this.bannerId.length - 1 && (this.banIndex = 0), this.bannerId[this.banIndex]
        }
        destroyBannerAd() {
            console.log("this.bannerAd：", this.bannerAd), this.bannerAd && (console.log("销毁banner"), this.bannerAd.destroy(), this.bannerAd = null)
        }
        resetBannerAd() {
            this.ch && (console.log("刷新banner"), this.destroyBannerAd(), this.createBannerAd(), this.bannerAd.show())
        }
        showBannerAd() {
            this.ch && this.bannerAd && S.game_banner && (console.log("显示banner", this.bannerAd), this.bannerAd.show())
        }
        hideBannerAd() {
            this.ch && this.bannerAd && this.bannerAd.hide()
        }
        createInterstitialAd() {
            this.ch && (this.insertAd = this.ch.createInsertAd({
                adUnitId: this.insertId
            }), this.insertAd.onLoad(() => {
                this.insertAd.offLoad(), console.log("插屏广告加载完毕")
            }), this.insertAd.onError(e => {
                this.insertAd.offError(), console.log("插屏广告错误", e)
            }))
        }
        showInterstitialAd(e = null) {
            this.ch && this.insertAd && (console.log("进入展示插屏广告"), this.insertAd.onClose(() => {
                console.log("插屏广告关闭"), this.insertAd.offClose(), e && e()
            }), this.insertAd.load(), this.insertAd.show())
        }
        createGameBannerAd() {
            this.ch && (console.log("快应用平台版本号: ", this.ch.getSystemInfoSync().platformVersionCode), this.ch.getSystemInfoSync().platformVersionCode >= 1076 ? (this.gameBannerAd = this.ch.createGameBannerAd({
                adUnitId: this.gameBannerAdId
            }), this.gameBannerAd.onLoad(() => {
                console.log("互推横幅加载成功")
            }), this.gameBannerAd.onError(e => {
                console.log("互推横幅错误：", e)
            })) : console.log("快应用平台版本号低于1076，暂不支持互推盒子相关 API"))
        }
        showGameBannerAd() {
            this.gameBannerAd && this.gameBannerAd.show()
        }
        hideGameBannerAd() {
            this.gameBannerAd && this.gameBannerAd.hide()
        }
        createGamePortalAd() {
            this.ch && (console.log("快应用平台版本号: ", this.ch.getSystemInfoSync().platformVersionCode), this.ch.getSystemInfoSync().platformVersionCode >= 1076 ? (this.gamePortalAd = this.ch.createGamePortalAd({
                adUnitId: this.gamePortalAdId
            }), this.gamePortalAd.onLoad(() => {
                console.log("互推9宫格加载成功")
            }), this.gamePortalAd.onError(e => {
                console.log("互推9宫格错误：", e)
            })) : console.log("快应用平台版本号低于1076，暂不支持互推盒子相关 API"))
        }
        showGamePortalAd(e = !1) {
            if (this.gamePortalAd) {
                if ((Laya.Browser.now() - y.go_game_time < S.fist_screen_time || Laya.Browser.now() - this.interstitial_time < S.interval_screen_time) && !e) return;
                console.log("显示插屏", Laya.Browser.now() - this.interstitial_time), this.interstitial_time = Laya.Browser.now(), this.gamePortalAd.load().then(() => {
                    this.gamePortalAd.show()
                }).catch(e => {
                    console.log("load fail with:" + e.errCode + "," + e.errMsg)
                })
            }
        }
        hideGamePortalAd() {
            this.gamePortalAd && this.gamePortalAd.hide()
        }
        gotoOther(e, t, i, s = null) {
            this.ch && t && this.ch.navigateToMiniGame({
                pkgName: t,
                path: i,
                success: function () {
                    console.log("打开成功: pkgName = ", t), s && s(!0)
                },
                fail: function (e) {
                    console.log("打开失败: pkgName = ", t), s && s(!1)
                }
            })
        }
        createNativeAd(e = null) {
            if (this.ch) {
                if (console.log("创建原生广告"), Laya.Browser.now() - this.nativeId_time < 6e4) return;
                this.nativeId_time = Laya.Browser.now(), this.nativeAd = this.ch.createNativeAd({
                    adUnitId: this.nativeId
                }), this.nativeAd.onLoad(t => {
                    console.log("原生广告加载完毕", t.adList), this.adContent = t.adList[0], console.log("原生广告加载完毕1", t.adList[0]), console.log("原生广告加载完毕2", this.adContent), this.nativeAd.offLoad(), e && e(t.adList[0])
                }), this.nativeAd.onError(e => {
                    console.log("原生广告错误", e), this.nativeAd.offError()
                }), this.nativeAd.load()
            }
        }
        clickNativeAd(e) {
            this.ch && (console.log("点击原生广告--点击上报"), this.nativeAd && this.nativeAd.reportAdClick({
                adId: e
            }))
        }
        reportShowNativeAd(e) {
            console.info("原生广告曝光上报"), this.ch && this.nativeAd && this.nativeAd.reportAdShow({
                adId: e
            })
        }
        showNativeAd(e) {
            this.ch && (console.log("显示原生广告"), this.nativeAd && this.nativeAd.reportAdShow({
                adId: e
            }))
        }
        destroyNativeAd() {
            this.ch && (console.log("销毁原生广告"), this.nativeAd && (this.nativeAd.destroy(), this.nativeAd = null))
        }
        installShortcut(e = null) {
            let t = Laya.Browser.window.qg;
            this.ch && (console.log("点击 创建桌面图标"), this.create_shortcut_time = Laya.Browser.now(), t.hasShortcutInstalled({
                success: i => {
                    this.isShortcut = !1, console.log("桌面图标是否存在:", i), 0 == i && t.installShortcut({
                        success: () => {
                            console.log("创建桌面图标成功", i), e && e(!0)
                        },
                        fail: t => {
                            console.log("创建桌面图标失败", t), e && e(!0)
                        },
                        complete: () => {
                            console.log("创建桌面图标完成")
                        }
                    })
                },
                fail: function (e) {},
                complete: function () {}
            }))
        }
        hasShortcutInstalled(e = null) {
            this.ch && this.ch.hasShortcutInstalled({
                success: t => {
                    e && e(t)
                },
                fail: function (t) {
                    e && e(!1)
                },
                complete: function () {}
            })
        }
        reportMonitor() {
            this.ch && (console.log("reportMonitor：", this.ch), this.ch.reportMonitor("game_scene", 0))
        }
        setKeepScreenOn(e = !0) {
            this.ch && this.ch.setKeepScreenOn({
                keepScreenOn: e,
                success(e) {
                    console.log("屏幕常亮开启")
                },
                fail(e) {
                    console.log("setKeepScreenOn调用失败")
                }
            })
        }
    }
    class D extends w {
        constructor(e) {
            super(e), this.videoAd = null, this.videoId = "25399a602add4a85bb3a32edf7a10474", this.bannerAd = null, this.banIndex = 0, this.bannerId = ["898a20891444434b889bea1a60dc1e4d"], this.insertAd = null, this.insertId = "167951946ab74323bdb89ecc32d8cad0", this.nativeAd = null, this.nativeCurrentAd = null, this.nativeId = "f500869d116d472894b0b3475c2c840c", this.adList = [], this.nativeId_time = 0, this.interstitial_time = 0, this.isShortcut = !0, this.create_shortcut_time = 0, this.bannerAdHeight = 200, this.videoCallback = null, this.getSystem(), this.onShowAlways(), this.createVideoAd(), this.createNativeAd(), this.onHide()
        }
        createVideoAd() {
            if (this.ch) {
                this.videoAd = qg.createRewardedVideoAd({
                    posId: this.videoId
                }), this.videoAd.onLoad(() => {
                    console.log("视频创建成功"), I.videoEnable = !0, this.videoAd.offLoad()
                }), this.videoAd.onError(e => {
                    I.videoEnable = !1, console.log("加载视频失败：", e)
                });
                let e = e => {
                    console.log("视频观看回调"), this.isShortcut = !0, e && e.isEnded ? (console.log("视频观看成功"), this.videoCallback && this.videoCallback(!0)) : console.log("视频观看失败"), y.sound_switch && (Laya.SoundManager.muted = !1)
                };
                this.videoAd.onClose(e)
            }
        }
        showVideoAd(e = null) {
            if (this.ch) {
                this.videoCallback = e;
                let t = this.videoAd.load();
                t && t.catch(e => {
                    this.videoCallback && this.videoCallback(!1), this.showToast("广告拉取繁忙，请稍后再试"), console.log("显示视频失败", e), y.sound_switch && (Laya.SoundManager.muted = !1)
                }), this.videoAd.offLoad(), this.videoAd.onLoad(() => {
                    let e = this.videoAd.show();
                    y.sound_switch && (Laya.SoundManager.muted = !0, console.log("静音")), this.isShortcut = !1, e && e.catch(e => {
                        this.videoCallback && this.videoCallback(!1), this.showToast("广告拉取繁忙，请稍后再试"), y.sound_switch && (Laya.SoundManager.muted = !1), this.isShortcut = !0
                    }), this.videoAd.offLoad()
                })
            }
        }
        createBannerAd() {
            if (this.ch) {
                this.bannerAdHeight = 200;
                let e = this.refreshBanId();
                this.bannerAd = qg.createBannerAd({
                    posId: e,
                    style: {}
                });
                let t = e => {
                    console.log("banner大小：", e), this.bannerAdHeight = e.height, this.bannerAd.offSize()
                };
                this.bannerAd.onSize(t), this.bannerAd.onError(e => {
                    console.log("创建banner广告报错: ", e)
                }), this.hideBannerAd()
            }
        }
        refreshBanId() {
            return this.banIndex++, this.banIndex > this.bannerId.length - 1 && (this.banIndex = 0), this.bannerId[this.banIndex]
        }
        destroyBannerAd() {
            this.bannerAd && this.bannerAd.destroy()
        }
        resetBannerAd() {
            this.ch && (this.destroyBannerAd(), this.createBannerAd())
        }
        showBannerAd() {
            this.ch && S.game_banner && (console.log("展示banner"), this.bannerAd && this.bannerAd.show().then(() => {
                console.log("banner广告展示成功")
            }).catch(e => {
                console.log("banner广告展示失败", e)
            }))
        }
        hideBannerAd() {
            this.bannerAd && (console.log("隐藏banner"), this.bannerAd.hide())
        }
        createInterstitialAd() {
            this.ch && (this.insertAd = this.ch.createInterstitialAd({
                posId: this.insertId
            }), this.insertAd.show().then(() => {
                console.log("插屏广告展示成功")
            }).catch(e => {
                console.log("插屏广告失败：", e)
            }))
        }
        showInterstitialAd() {
            if (this.ch) {
                if (Laya.Browser.now() - y.go_game_time < S.fist_screen_time || Laya.Browser.now() - this.interstitial_time < S.interval_screen_time) return;
                console.log("显示插屏", Laya.Browser.now() - this.interstitial_time), this.interstitial_time = Laya.Browser.now(), this.insertAd = this.ch.createInterstitialAd({
                    posId: this.insertId
                }), this.insertAd.show().then(() => {
                    console.log("插屏广告展示成功")
                }).catch(e => {
                    console.log("插屏广告展示失败：", e)
                })
            }
        }
        createNativeAd(e = null) {
            if (this.ch) {
                if (console.log("创建原生广告"), Laya.Browser.now() - this.nativeId_time < 6e4) return;
                this.nativeId_time = Laya.Browser.now(), this.nativeAd = this.ch.createNativeAd({
                    adUnitId: this.nativeId
                }), this.nativeAd.onLoad(t => {
                    console.log("原生广告加载完毕", t.adList), this.adContent = t.adList[0], e && e(t.adList[0]), this.nativeAd.offLoad()
                }), this.nativeAd.onError(e => {
                    console.log("原生广告错误", e), this.nativeAd.offError()
                }), this.nativeAd.load()
            }
        }
        destroyNativeAd() {
            this.ch && this.nativeAd && (console.log("销毁原生广告"), this.nativeAd.destroy(), this.nativeAd = null)
        }
        clickNativeAd(e) {
            this.ch && this.nativeAd && (this.nativeAd.reportAdShow({
                adId: e + ""
            }), this.nativeAd.reportAdClick({
                adId: e + ""
            }))
        }
        installShortcut() {
            let e = this.ch = Laya.Browser.window.qg;
            this.ch && (this.create_shortcut_time = Laya.Browser.now(), e.installShortcut({
                success: function () {
                    console.log("创建成功")
                },
                fail: function (e) {
                    console.log("创建失败", e)
                },
                complete: function () {}
            }))
        }
        hasShortcutInstalled(e = null) {
            this.ch = Laya.Browser.window.qg;
            this.ch && this.ch.hasShortcutInstalled({
                success: function (t) {
                    e && e(t)
                },
                fail: function (t) {
                    e && e(!1)
                }
            })
        }
        share(e = null) {
            this.ch && this.ch.share({
                success: () => {
                    e && e(!0), this.showToast("分享成功")
                },
                fail: (t, i) => {
                    e && e(!1), this.showToast("分享失败")
                },
                cancel: () => {
                    e && e(!1), this.showToast("取消分享")
                },
                complete: function () {}
            })
        }
        gotoOther(e, t, i = null) {
            this.ch && t && this.ch.navigateToMiniGame({
                pkgName: t,
                success: function () {
                    console.log("打开成功: pkgName = ", t), i && i(!0)
                },
                fail: function (e) {
                    console.log("打开失败: pkgName = ", t), i && i(!1)
                }
            })
        }
        showToast(e, t = "none", i = 2e3) {
            this.ch && this.ch.showToast({
                message: e,
                icon: t,
                duration: i
            })
        }
        setKeepScreenOn(e = !0) {
            this.ch && this.ch.setKeepScreenOn({
                keepScreenOn: e,
                success(e) {
                    console.log("屏幕常亮开启")
                },
                fail(e) {
                    console.log("setKeepScreenOn调用失败")
                }
            })
        }
    }
    class P extends w {
        constructor(e) {
            super(e), this.videoAd = null, this.videoId = "yfZC8xjF", this.bannerAd = null, this.banIndex = 0, this.bannerId = ["ivUXNGW6"], this.insertAd = null, this.insertId = "Lf0YWzqi", this.qg = null, this.qg = Laya.Browser.window.qg, this.getSystemInfo(), this.onShowAlways(), this.createBannerAd(), this.createVideoAd(), this.createInterstitialAd(), this.onHide()
        }
        getSystemInfo() {
            if (this.qg) {
                let e = I.systemInfo = this.qg.getSystemInfoSync();
                I.screenWidth = e.screenWidth, I.screenHeight = e.screenHeight, console.log("系统参数：", e)
            }
        }
        share(e = null, t = "article", i = {}) {
            this.ch && T.shareDataLoad(() => {
                let s = T.getOneShareData(),
                    a = Laya.Browser.now() + "" + ~~(1e4 * (.1 + Math.random() / 2));
                "article" == t ? this.ch.shareAppMessage({
                    title: s.title,
                    imageUrl: s.img_url,
                    query: "&sn=" + a + "&share_id=" + s.id,
                    extra: i,
                    success() {
                        console.log("分享成功"), e && e(!0)
                    },
                    fail(t) {
                        console.log("分享失败"), e && e(!1)
                    }
                }) : this.ch.shareAppMessage({
                    channel: t,
                    title: s.title,
                    imageUrl: s.img_url,
                    query: "&sn=" + a + "&share_id=" + s.id,
                    extra: i,
                    success() {
                        console.log("分享成功"), e && e(!0)
                    },
                    fail(t) {
                        console.log("分享失败"), e && e(!1)
                    }
                })
            })
        }
        createVideoAd() {
            this.qg
        }
        showVideoAd(e = null) {
            this.qg && this.qg && (this.videoAd = this.qg.createRewardedVideoAd({
                adUnitId: this.videoId
            }), this.videoAd.load(), this.videoAd.offLoad(), this.videoAd.onLoad(() => {
                console.log("励视频加载成功"), I.videoEnable = !0, this.videoAd.show(), this.videoAd.offLoad()
            }), this.videoAd.offRewarded(), this.videoAd.onRewarded(() => {
                console.log("激励视频广告完成，发放奖励"), e && e(!0), this.videoAd.offRewarded()
            }), this.videoAd.onError(), this.videoAd.onError(e => {
                console.log("视频广告拉取失败", e), this.videoAd.onError()
            }))
        }
        createBannerAd(e = !1) {
            if (this.qg) {
                let e = this.refreshBanId();
                this.bannerAd = this.qg.createBannerAd({
                    adUnitId: this.bannerId,
                    adIntervals: e,
                    style: {
                        top: -1
                    }
                })
            }
        }
        refreshBanId() {
            return this.banIndex++, this.banIndex > this.bannerId.length - 1 && (this.banIndex = 0), this.bannerId[this.banIndex]
        }
        destroyBannerAd() {}
        showBannerAd() {
            this.qg && (console.log("显示 banner"), this.bannerAd.show())
        }
        hideBannerAd() {
            this.qg && (console.log("隐藏 banner"), this.bannerAd.hide())
        }
        createInterstitialAd() {
            this.qg && (this.insertAd = this.qg.createInsertAd({
                adUnitId: this.insertId
            }), this.insertAd.hide())
        }
        showInterstitialAd() {
            console.log("显示插屏广告"), this.qg && (this.insertAd.load(), this.insertAd.onLoad(() => {
                console.log("insert 广告加载成功"), this.insertAd.show(), this.insertAd.offLoad()
            }))
        }
        showToast(e, t = "none", i = 2e3) {
            this.ch && this.ch.showToast({
                message: e,
                duration: i
            })
        }
    }
    class N extends w {
        constructor(e) {
            super(e), this.videoAd = null, this.videoId = "159231", this.bannerAd = null, this.banIndex = 0, this.bannerId = ["159225", "159225"], this.insertAd = null, this.insertId = "159226", this.nativeAd = null, this.nativeId = "159230", this.videoCallback = null, this.addEventListener(), this.createVideoAd()
        }
        createVideoAd() {
            if (this.ch) {
                console.log("点击创建视频"), this.videoAd = this.ch.createRewardVideoAd(), this.videoAd.onLoad(() => {
                    console.log("励视频加载成功"), I.videoEnable = !0, this.videoAd.offLoad()
                }), this.videoAd.onError(e => {
                    console.log("视频创建错误：", e), I.videoEnable = !1
                }), this.videoAd.load();
                let e = e => {
                    e && e.isEnded ? (console.log("视频观看成功"), this.videoCallback && this.videoCallback(!0)) : (console.log("视频观看失败"), this.videoCallback && this.videoCallback(!1))
                };
                this.videoAd.onClose(e)
            }
        }
        showVideoAd(e = null) {
            console.log("点击观看视频", I.videoEnable), this.ch && this.videoAd && (this.videoCallback = e, this.videoAd.load().then(() => {
                this.videoAd.show()
            }).catch(e => {
                console.log("拉取视频失败", e), this.showToast("暂无广告，请稍后再试")
            }))
        }
        createBannerAd() {
            if (this.ch) {
                let e = this.refreshBanId();
                this.bannerAd = this.ch.createBannerAd({
                    adUnitId: e,
                    adIntervals: 30,
                    style: {
                        gravity: 7
                    }
                }), this.bannerAd.onLoad(() => {
                    console.log("banner创建成功 id=", e), this.bannerAd.offLoad()
                }), this.bannerAd.onResize(() => {
                    console.log("Resize", this.bannerAd), this.bannerAd.offResize()
                }), this.bannerAd.onError(e => {
                    console.log("创建banner失败: ", e)
                }), this.hideBannerAd()
            }
        }
        refreshBanId() {
            return this.banIndex++, this.banIndex > this.bannerId.length - 1 && (this.banIndex = 0), this.bannerId[this.banIndex]
        }
        destroyBannerAd() {
            console.log("this.bannerAd：", this.bannerAd), this.bannerAd && (console.log("销毁banner"), this.bannerAd.destroy(), this.bannerAd = null)
        }
        resetBannerAd() {
            this.ch && (console.log("刷新banner"), this.destroyBannerAd(), this.createBannerAd())
        }
        showBannerAd() {
            this.ch && this.bannerAd && (console.log("显示banner", this.bannerAd), this.bannerAd.show())
        }
        hideBannerAd() {
            this.ch && this.bannerAd && this.bannerAd.hide()
        }
        createInterstitialAd() {
            this.ch
        }
        showInterstitialAd() {
            console.log("显示插屏广告"), this.ch
        }
        shareAppMessage() {
            this.ch && T.shareDataLoad(() => {
                let e = T.getOneShareData(),
                    t = Laya.Browser.now() + "" + ~~(1e4 * (.1 + Math.random() / 2));
                this.ch.shareAppMessage({
                    title: e.title,
                    imageUrl: e.img_url,
                    query: "&sn=" + t + "&share_id=" + e.id,
                    success: e => {
                        console.log("shareAppMessage share success", JSON.stringify(e))
                    },
                    fail: e => {
                        console.log("shareAppMessage share fail", JSON.stringify(e))
                    }
                })
            })
        }
        reportUserAction() {
            this.ch && this.ch.reportUserAction({
                scene: "xxx",
                action: "PLAY",
                score: "100",
                success: function (e) {
                    console.log(e)
                },
                fail: function (e) {
                    console.error(e)
                }
            })
        }
        addEventListener() {
            this.ch && document.addEventListener("visibilitychange", e => {
                console.log(document.visibilityState), "visible" == document.visibilityState && console.log("回到前台"), "hidden" == document.visibilityState && console.log("退出前台")
            })
        }
        showToast(e, t = "none", i = 2e3) {
            this.ch && this.ch.showToast({
                content: e,
                duration: i
            })
        }
    }
    class O extends w {
        constructor(e) {
            super(e), this.videoAd = null, this.videoId = "", this.bannerAd = null, this.banIndex = 0, this.bannerId = [""], this.insertAd = null, this.insertId = ""
        }
        createVideoAd() {
            throw new Error("Method not implemented.")
        }
        showVideoAd(e = null) {
            // console.log("看视频1111：", this.ch), this.ch && (console.log("看视频：", this.ch), console.log("有广告资源可播放"), this.ch.playAd(t => {
            //     console.log("播放广告回调数据", t), 1e4 === t.code ? (console.log("开始播放"), Laya.SoundManager.muted = !0) :
            //      10001 === t.code ? (console.log("播放结束"), e && e(!0), y.sound_switch && (Laya.SoundManager.muted = !1)) : 
            //      (console.log("广告异常"), e && e(!1), y.sound_switch && (Laya.SoundManager.muted = !1))
            // }))
            window.startVideo=true
            console.log("Sy --- 视频");
            VkApp.showRewarded(() => {
                e && e(!0)
                window.startVideo=false
            },()=>{
                window.startVideo=false
            })
            return;
        }
        getVideoNum(e) {
            console.log("是否可播放广告： ", e.canPlayAd, "\n", "剩余次数： ", e.remain)
        }
        createBannerAd() {
            throw new Error("Method not implemented.")
        }
        destroyBannerAd() {
            throw new Error("Method not implemented.")
        }
        showBannerAd() {
            throw new Error("Method not implemented.")
        }
        hideBannerAd() {
            throw new Error("Method not implemented.")
        }
        showInterstitialAd() {}
        login(e = null) {
            this.ch && this.ch.login(e => {
                console.log("用户编号：", e.uId), console.log("用户昵称：", e.userName)
            })
        }
        isLogin() {
            if (this.ch) {
                this.ch.isLogin() ? console.log("已登录") : console.log("未登录")
            }
        }
        getUserAvatar(e) {
            if (this.ch) return this.ch.getUserAvatar(e)
        }
        showRanking() {
            this.ch && this.ch.showRanking()
        }
        getRanking() {
            this.ch && this.ch.getRanking(e => {
                1e4 == e.code ? e.data.list.forEach(e => {
                    -1 != e.rank ? console.log("当前排名：", e.rank) : console.log("未进入排行榜"), console.log("分数：", e.score), console.log("用户编号：", e.uId), console.log("昵称：", e.userName)
                }) : console.log("获取排名列表失败")
            }, 1, 10)
        }
        getMyRanking() {
            this.ch && this.ch.getMyRanking(e => {
                1e4 == e.code ? (console.log("当前分数：", e.data.score), -1 != e.data.rank ? console.log("当前排名：", e.data.rank) : console.log("未进入排行榜")) : console.log("获取当前排名失败")
            })
        }
        getNearRanking() {
            this.ch && this.ch.getNearRanking(e => {
                if (1e4 == e.code) {
                    let t = e.data.list;
                    if (t.length)
                        for (let e = 0; e < t.length; e++) {
                            let i = t[e].uId,
                                s = t[e].userName,
                                a = t[e].rank;
                            console.log("编号：" + i, "昵称：" + s, "排名：" + a)
                        } else console.log("未进入排行榜")
                } else console.log("获取我排名附近的排名列表失败"), console.log("")
            }, 10)
        }
        submitRanking(e) {
            this.ch && this.ch.submitRanking(e, e => {
                1e4 == e.code ? (console.log("分数提交成功"), console.log("历史最好分数：", e.history.score), -1 != e.history.rank ? console.log("历史最好分数的排名：", e.history.rank) : console.log("未进入排行榜")) : console.log("分数提交失败"), console.log("")
            })
        }
    }
    class U {
        constructor(e) {
            console.log("platform:", e), U.platform = e, this.initPlatform()
        }
        initPlatform() {
            console.log("CM.platform:", U.platform), console.log("CM:", 1), U.platform == U.CH_WEIXIN ? U.mainCH = new x(U.onWindow()) : U.platform == U.CH_QQ ? U.mainCH = new k(U.onWindow()) : U.platform == U.CH_ZJ ? U.mainCH = new B(U.onWindow()) : U.platform == U.CH_BAIDU ? U.mainCH = new R(U.onWindow()) : U.platform == U.CH_OPPO ? U.mainCH = new M(U.onWindow()) : U.platform == U.CH_VIVO ? U.mainCH = new D(U.onWindow()) : U.platform == U.CH_MZ ? U.mainCH = new P(U.onWindow()) : U.platform == U.CH_UC ? U.mainCH = new N(U.onWindow()) : U.platform == U.CH_H5 && (U.mainCH = new O(U.onWindow()))
        }
        static onWindow() {
            return U.platform == U.CH_WEIXIN ? Laya.Browser.window.wx : U.platform == U.CH_QQ ? Laya.Browser.window.qq : U.platform == U.CH_ZJ ? Laya.Browser.window.tt : U.platform == U.CH_BAIDU ? Laya.Browser.window.swan : U.platform == U.CH_OPPO ? Laya.Browser.window.qg : U.platform == U.CH_VIVO ? Laya.Browser.window.qg : U.platform == U.CH_XIAOMI ? Laya.Browser.window.qg : U.platform == U.CH_HUAWEI ? Laya.Browser.window.hbs : U.platform == U.CH_MZ ? Laya.Browser.window.mz : U.platform == U.CH_UC ? Laya.Browser.window.uc : U.platform == U.CH_H5 ? Laya.Browser.window.h5api : void console.log("CM:", 4)
        }
        static onMiniGame() {
            return U.platform == U.CH_WEIXIN ? Laya.Browser.onMiniGame : U.platform == U.CH_QQ ? "qq" in Laya.Browser.window && Laya.Browser.userAgent.indexOf("MiniGame") > -1 : U.platform == U.CH_ZJ ? Laya.Browser.onMiniGame : U.platform == U.CH_BAIDU ? Laya.Browser.onBDMiniGame : U.platform == U.CH_OPPO ? Laya.Browser.onQGMiniGame : U.platform != U.CH_VIVO && (U.platform == U.CH_XIAOMI ? Laya.Browser.onKGMiniGame : U.platform == U.CH_HUAWEI || U.platform != U.CH_MZ && (U.platform != U.CH_UC && (U.platform != U.CH_H5 && void 0)))
        }
        static getPlatform() {
            return this.platform
        }
        static isPlatform(e) {
            return e == this.platform
        }
    }
    U.mainCH = null, U.CH_WEIXIN = "WX", U.CH_QQ = "QQ", U.CH_ZJ = "ZJ", U.CH_BAIDU = "BD", U.CH_VIVO = "VIVO", U.CH_OPPO = "OPPO", U.CH_HUAWEI = "HW", U.CH_XIAOMI = "XM", U.CH_MZ = "MZ", U.CH_UC = "UC", U.CH_H5 = "H5", U.platform = U.CH_WEIXIN;
    class V {
        constructor() {
            this.drama_id = 0, this.res_id = 0, this.v_gold = 0, this.f_gold = 0, this.name = ""
        }
        static creatByJson(e) {
            var t = new V;
            return t.drama_id = e.drid, t.res_id = e.rid, t.v_gold = e.gh, t.f_gold = e.fh, t.name = e.nm, t
        }
    }
    V.JSON_RES_NAME = "drama_core.json", V.JSON_KEY = "drama_temp";
    class F {
        constructor() {
            this.res_id = 0, this.way = 0, this.pack_type = 0, this.way_qq = 0, this.way_zijie = 0, this.way_baidu = 0, this.way_vivo = 0, this.way_oppo = 0, this.way_huawei = 0, this.way_xiaomi = 0, this.version_qq = 0, this.version_zijie = 0, this.version_baidu = 0, this.version_vivo = 0, this.version_oppo = 0, this.version_huawei = 0, this.version_xiaomi = 0
        }
        static creatByJson(e) {
            var t = new F;
            return t.res_id = e.rid, t.res_type = e.rty, t.pack_type = e.t, U.onMiniGame() && "atlas" != this.getSubPackName(t.pack_type) ? t.res = this.getSubPackName(t.pack_type) + "/" + e.res : t.res = "res/" + this.getSubPackName(t.pack_type) + "/" + e.res, t.way = e.way, t.version = e.v, t.way_qq = e.q, t.way_zijie = e.z, t.way_baidu = e.b, t.way_vivo = e.i, t.way_oppo = e.o, t.way_huawei = e.h, t.way_xiaomi = e.x, t.version_qq = e.qv, t.version_zijie = e.zv, t.version_baidu = e.bv, t.version_vivo = e.iv, t.version_oppo = e.ov, t.version_huawei = e.hv, t.version_xiaomi = e.xv, t
        }
        static getSubPackName(e) {
            switch (e) {
                case 0:
                    return "";
                case 1:
                    return "atlas";
                case 2:
                    return "other";
                case 3:
                    return "home";
                case 6:
                    return "share";
                case 7:
                    return "sounds";
                case 11:
                    return "map_1";
                case 12:
                    return "map_2";
                case 13:
                    return "map_3";
                case 14:
                    return "map_4";
                case 15:
                    return "map_5";
                case 16:
                    return "map_6"
            }
        }
    }
    class H {
        constructor() {
            this.load_way_force = 2, this.sub_pakage_enable = !1, this.channel = "VIVO", this.sub_package_stage = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], this.music_asyn_arr = new Array, H.instance = this, this.channel = U.CH_H5
        }
        creatByJson(e = null) {
            Laya.loader.create([H.LOADER_CORE_JSON_RES, H.JSON_PATH + V.JSON_RES_NAME], Laya.Handler.create(this, () => {
                var t = Laya.loader.getRes(H.LOADER_CORE_JSON_RES);
                this.base_url = t.base_url, this.latest_version = t.latest_version, this.creatResTempListByJson(t.res_list), e && e.run()
            }))
        }
        creatResTempListByJson(e) {
            this.res_arr = new Array;
            for (var t = 0; t < e.length; t++) {
                var i = F.creatByJson(e[t]);
                this.res_arr.push(i)
            }
        }
        loadSkeleton(e, t, i) {
            this.loadSkeletonToPos(e, t, i)
        }
        loadSkeletonToPos(e, t, i, s, a, n) {
            var r = e.split("/"),
                o = r[r.length - 1],
                l = this.getCompleteResByResName(o),
                h = l.replace("sk", "png");
            Laya.loader.load([l, h], Laya.Handler.create(this, () => {
                var e = Laya.loader.getRes(h),
                    r = Laya.loader.getRes(l),
                    o = new Laya.Templet;
                o.parseData(e, r);
                var c = o.buildArmature(null == i ? 0 : i);
                null != s && null != a && c.pos(s, a), null != n && (c.zOrder = n), c.url_sk = l, c.url_png = h, t.args = [c], t.run(), l = null, h = null
            }))
        }
        clearSkeletonRes(e) {
            if (e) {
                var t = e.url_sk;
                t && Laya.loader.clearRes(t), t = null;
                var i = e.url_png;
                i && Laya.loader.clearRes(i), i = null
            }
        }
        clearSkeletonResByName(e) {
            var t = this.getCompleteResByResName(e);
            if (t) {
                Laya.loader.clearRes(t);
                var i = t.replace("sk", "png");
                Laya.loader.clearRes(i), t = null, i = null
            }
        }
        loadMaterialTexture2D(e, t, i, s, a) {
            Laya.Texture2D.load(s, Laya.Handler.create(null, function (s) {
                t += "(Instance)";
                var n = null;
                if (e.skinnedMeshRenderer) n = e.skinnedMeshRenderer;
                else {
                    if (!e.meshRenderer) return console.warn("loadMaterialColor 找不到 预定义的渲染器"), void a.run();
                    n = e.meshRenderer
                }
                for (var r = !1, o = 0; o < n.materials.length; o++)
                    if (n.materials[o].name == t) {
                        var l = null;
                        "bp_albedo_tex" == i ? (l = n.materials[o]).albedoTexture = s : "bp_albedo_nor" == i ? (l = n.materials[o]).normalTexture = s : "e_tex" == i ? (l = n.materials[o]).texture = s : "un_albedo_tex" == i && ((l = n.materials[o]).albedoTexture = s), l && (n.materials[o] = l, r = !0);
                        break
                    } a.args[2] = r, a.run()
            }))
        }
        loadMaterialColor(e, t, i, s) {
            t += "(Instance)";
            var a = null;
            if (e.skinnedMeshRenderer) a = e.skinnedMeshRenderer;
            else {
                if (!e.meshRenderer) return void console.warn("loadMaterialColor 找不到 预定义的渲染器");
                a = e.meshRenderer
            }
            for (var n = 0; n < a.materials.length; n++)
                if (a.materials[n].name == t) {
                    var r = null;
                    "bp_albedo_color" == i ? (r = a.materials[n]).albedoColor = this.colorHEXToVector(s) : "e_color" == i ? (r = a.materials[n]).color = this.colorHEXToVector(s) : "un_albedo_color" == i && ((r = a.materials[n]).albedoColor = this.colorHEXToVector(s)), r && (a.materials[n] = r);
                    break
                }
        }
        colorHEXToVector(e, t) {
            null == t && (t = !1);
            var i = e.substring(1, 3),
                s = (16 * parseInt(i[0], 16) + parseInt(i[1], 16)) / 255,
                a = e.substring(3, 5),
                n = (16 * parseInt(a[0], 16) + parseInt(a[1], 16)) / 255,
                r = e.substring(5, 7),
                o = (16 * parseInt(r[0], 16) + parseInt(r[1], 16)) / 255;
            if (9 == e.length || t) {
                var l = 1;
                if (9 == e.length) {
                    var h = e.substring(7, 9);
                    l = (16 * parseInt(h[0], 16) + parseInt(h[1], 16)) / 255
                }
                return new Laya.Vector4(s, n, o, l)
            }
            return 7 == e.length ? new Laya.Vector3(s, n, o) : null
        }
        getResTempByID(e) {
            for (var t = 0; t < this.res_arr.length; t++) {
                var i = this.res_arr[t];
                if (i.res_id == e) return i
            }
            return console.warn("[警告]未找到 指定rid的 资源模板 请检查 rid=" + e), null
        }
        getCompleteResByResName(e) {
            var t = this.getResTempByRes(e);
            return t ? this.getCompleteRes(t) : null
        }
        getCompleteResByID(e) {
            var t = this.getResTempByID(e);
            return t ? this.getCompleteRes(t) : null
        }
        getResTempByRes(e) {
            for (var t = 0; t < this.res_arr.length; t++) {
                var i = this.res_arr[t];
                if (i.res.indexOf(e) > -1) return i
            }
            return console.warn("[警告]在json中未找到资源模板 res=" + e), null
        }
        getCompleteRes(e) {
            var t = e.way,
                i = e.version;
            if (this.channel == H.CH_ZJ ? (t = e.way_zijie, i = e.version_zijie + "") : this.channel == H.CH_QQ ? (t = e.way_qq, i = e.version_qq + "") : this.channel == H.CH_BAIDU ? (t = e.way_baidu, i = e.version_baidu + "") : this.channel == H.CH_VIVO ? (t = e.way_vivo, i = e.version_vivo + "") : this.channel == H.CH_OPPO ? (t = e.way_oppo, i = e.version_oppo + "") : this.channel == H.CH_XIAOMI ? (t = e.way_xiaomi, i = e.version_xiaomi + "") : this.channel == H.CH_HUAWEI && (t = e.way_huawei, i = e.version_huawei + ""), 3 == this.load_way_force) return this.base_url + "/" + this.channel + "/" + i + "/" + e.res;
            if (2 == this.load_way_force) {
                if (0 == t) return e.res;
                if (1 == t) return this.base_url + "/" + this.channel + "/" + i + "/" + e.res
            } else {
                if (1 == this.load_way_force) return this.base_url + "/" + this.channel + i + "/" + e.res;
                if (0 == this.load_way_force) return e.res
            }
            return e.res
        }
        setLoadWayForce(e) {
            this.load_way_force = e
        }
        setChannel(e) {
            this.channel = e, e == H.CH_ZJ && (this.sub_pakage_enable = !1)
        }
        getCompleteResListByIDs(e) {
            for (var t = (e = e.substr(1, e.length - 2)).split(","), i = new Array, s = 0; s < t.length; s++) Number(t[s]);
            return i
        }
        preloadingSound(e, t) {
            for (var i = new Array, s = 0; s < e.length; s++) e[s] > 5e4 && i.push(H.instance.getCompleteResByID(e[s]));
            i.length > 0 && Laya.loader.load(i, Laya.Handler.create(this, () => {
                e = null, i = null, t && t()
            }))
        }
        static loadSubPack(e, t) {
            let i = Laya.Browser.window.wx;
            if (i) {
                var s = (new Date).getTime();
                i.loadSubpackage({
                    name: e,
                    success: i => {
                        console.log(e + "分包 加载耗时：" + ((new Date).getTime() - s)), t()
                    },
                    fail: i => {
                        console.error(e + "分包加载失败"), t()
                    }
                })
            } else t()
        }
        loadSubPack(e, t) {
            if (U.onMiniGame() && 2 == this.load_way_force)
                if (this.sub_pakage_enable)
                    if (console.log("加载分包", e), this.sub_package_stage[e] == H.SUB_PACKAGE_STAGE_NO) {
                        let s = U.onWindow();
                        if (s) {
                            this.sub_package_stage[e] = H.SUB_PACKAGE_STAGE_LOADING;
                            var i = (new Date).getTime();
                            s.loadSubpackage({
                                name: F.getSubPackName(e),
                                success: s => {
                                    this.sub_package_stage[e] = H.SUB_PACKAGE_STAGE_SC, console.log(F.getSubPackName(e) + "分包 加载耗时：" + ((new Date).getTime() - i)), t()
                                },
                                fail: i => {
                                    console.error(F.getSubPackName(e) + "分包加载失败"), t()
                                }
                            })
                        }
                    } else this.sub_package_stage[e] == H.SUB_PACKAGE_STAGE_LOADING ? t() : this.sub_package_stage[e] == H.SUB_PACKAGE_STAGE_SC && t();
            else t();
            else t()
        }
        loadSubSounds(e) {}
        playSound(e, t) {
            var i = this.getCompleteResByID(e);
            // Laya.SoundManager.playSound(i, t)
            CoinAppAudio.playSound("ru/" + i)
        }
        stopSound(e) {
            if (e > 0) {
                var t = this.getCompleteResByID(e);
                Laya.SoundManager.stopSound(t)
            }
        }
        playMusic(e) {
            if (e > 0) {
                var t = this.getCompleteResByID(e);
                console.info("url:", t)
                // Laya.SoundManager.playMusic(t, 0)
            }
        }
        stopMusic() {
            Laya.SoundManager.stopMusic()
        }
        activeAllSound(e) {
            Laya.SoundManager.muted = !e
        }
    }
    H.JSON_PATH = "res/atlas/json/", H.DBMODULE_PATH = "res/atlas/dbmodule/", H.LOADER_CORE_JSON_RES = H.JSON_PATH + "loader_core.json", H.SUB_ID_ALTAS = 1, H.SUB_ID_OTHER = 2, H.SUB_ID_HOME = 3, H.SUB_ID_FPS = 4, H.SUB_ID_BOX = 5, H.SUB_ID_SHARE = 6, H.SUB_ID_SOUNDS = 7, H.SUB_ID_MAP_1 = 11, H.SUB_ID_MAP_2 = 12, H.SUB_ID_MAP_3 = 13, H.SUB_ID_MAP_4 = 14, H.SUB_ID_MAP_5 = 15, H.SUB_ID_MAP_6 = 16, H.CH_WEIXIN = "WX", H.CH_QQ = "QQ", H.CH_ZJ = "ZJ", H.CH_BAIDU = "BD", H.CH_VIVO = "VIVO", H.CH_OPPO = "OPPO", H.CH_HUAWEI = "HW", H.CH_XIAOMI = "XM", H.SUB_PACKAGE_STAGE_NO = 0, H.SUB_PACKAGE_STAGE_LOADING = 1, H.SUB_PACKAGE_STAGE_SC = 2;
    class G {
        constructor() {
            this._container = new Object, this._length = 0
        }
        get container() {
            return this._container
        }
        get length() {
            return this._length
        }
        add(e, t) {
            return this.hasKey(e) || this._length++, this._container[e] = t, t
        }
        forEach(e) {
            for (let t in this._container)
                if (!e(this._container[t])) return
        }
        forIn(e) {
            for (let t in this._container) e(t)
        }
        valueOf() {
            var e = [];
            for (let t in this._container) e.push(this._container[t]);
            return e
        }
        get(e) {
            return this._container[e]
        }
        reset(e, t) {
            this.hasKey(e) ? this._container[e] = t : console.log("ObjDictionary:varning you reset a not exist key")
        }
        hasKey(e) {
            return this._container.hasOwnProperty(e)
        }
        remove(e) {
            if (this._container.hasOwnProperty(e)) {
                let t = this._container[e];
                return this._container[e] = null, delete this._container[e], this._length--, t
            }
            return null
        }
        clear() {
            this._length = 0, this._container = null, this._container = new Object
        }
    }
    class K {
        static addSPList(e, t, i = -1) {
            let s = e.getKey();
            if (!this.m_SPTable.hasKey(s)) {
                let a = new z(e, t, i);
                this.m_SPTable.add(s, a)
            }
        }
        static removeSPList(e, t = -1, i = -1) {
            let s = this.getKey(e, t, i);
            this.m_SPTable.hasKey(s) && (this.m_SPTable.get(s).destroy(), this.m_SPTable.remove(s))
        }
        static preLoad(e, t) {
            let i = new Array;
            this.m_SPTable.forIn(e => {
                let t = this.m_SPTable.get(e),
                    s = H.instance.getCompleteResByID(t.maker.rid); - 1 == i.indexOf(s) && i.push(s)
            }), i.length > 0 ? Laya.loader.create(i, Laya.Handler.create(this, () => {
                this.m_SPTable.forIn(e => {
                    let t = this.m_SPTable.get(e);
                    0 == t.list.length && t.prefabCreate(t.prefab_num)
                }), t.call(e)
            })) : t.call(e)
        }
        static onUpdate() {
            this.m_SPTable.forIn(e => {
                this.m_SPTable.get(e).checkAutoRecovery()
            })
        }
        static getChildID(e, t) {
            let i = Laya.loader.getRes(H.instance.getCompleteResByID(e));
            for (let e = 0; e < i.numChildren; e++)
                if (i.getChildAt(e).name == t) return e;
            return -1
        }
        static getSPBySonName(e, t) {
            let i = K.getChildID(e, t);
            return -1 == i ? null : K.getSP(e, i)
        }
        static getSP(e, t = -1, i = -1) {
            let s = this.getKey(e, t, i);
            return this.m_SPTable.hasKey(s) ? this.m_SPTable.get(s).getOne() : null
        }
        static getSPList(e, t = -1, i = -1) {
            let s = this.getKey(e, t, i);
            return this.m_SPTable.hasKey(s) ? this.m_SPTable.get(s) : null
        }
        static recoverySP(e) {
            let t = e.mem_rid,
                i = e.mem_son_index,
                s = e.mem_gson_index;
            if (null == t || null == i || null == s) return void console.warn("回收失败！" + e.id);
            let a = this.getKey(t, i, s);
            this.m_SPTable.hasKey(a) ? this.m_SPTable.get(a).recovery(e) : console.warn("回收失败！" + e.id)
        }
        static recoveryComplexSP(e, t = !1) {
            let i = new Array;
            this.recoveryComplexSPCore(e, i);
            for (let e = 0; e < i.length; e++) {
                let t = i[e];
                this.recoverySP(t)
            }
            if (t) {
                let t = e.mem_rid,
                    i = e.mem_son_index,
                    s = e.mem_gson_index;
                if (null == t || null == i || null == s) return;
                this.recoverySP(e)
            }
        }
        static recoveryComplexSPCore(e, t) {
            for (let i = 0; i < e.numChildren; i++) {
                let s = e.getChildAt(i);
                this.recoveryComplexSPCore(s, t);
                let a = s.mem_rid,
                    n = s.mem_son_index,
                    r = s.mem_gson_index;
                null != a && null != n && null != r && t.push(s)
            }
        }
        static getKey(e, t = -1, i = -1) {
            let s = e + "";
            return t > -1 && (s = e + "_" + t), i > -1 && (s = e + "_" + t + "_" + i), s
        }
        static clearAll(e) {
            this.m_SPTable.forIn(t => {
                if (e && e.indexOf(t) > -1) return;
                this.m_SPTable.get(t).destroy()
            }), Laya.Resource.destroyUnusedResources()
        }
    }
    K.m_SPTable = new G;
    class z {
        constructor(e, t, i) {
            this.limit = 5, this.maker = e, this.prefab_num = t, this.limit = i > 0 ? i : this.prefab_num, this.list = new Array, this.pool = new Array
        }
        getOne() {
            let e = null;
            return this.pool.length > 0 ? e = this.pool.shift() : this.list.length >= this.limit ? (e = this.getOldOne()).removeSelf() : (e = this.maker.create(), this.list.push(e)), this.refreshStartTime(e), e
        }
        getOldOne() {
            let e = Laya.timer.currTimer,
                t = null;
            for (let i = 0; i < this.list.length; i++) {
                let s = this.list[i],
                    a = s.mem_start_time;
                if (null == a) return s;
                a <= e && (e = a, t = s)
            }
            return t
        }
        refreshStartTime(e) {
            e.mem_start_time = Laya.timer.currTimer
        }
        prefabCreate(e) {
            for (let t = 0; t < e; t++) {
                let e = this.maker.create();
                this.list.push(e), this.pool.push(e)
            }
        }
        recovery(e) {
            e.removeSelf(), this.pool.indexOf(e) > -1 || this.pool.push(e)
        }
        checkAutoRecovery() {
            if (-1 == this.maker.show_duan) return;
            let e = Laya.timer.currTimer;
            this.list.forEach(t => {
                e - t.mem_start_time > this.maker.show_duan && -1 == this.pool.indexOf(t) && this.recovery(t)
            })
        }
        destroy() {
            this.list.forEach(e => {
                e.destroy()
            }), this.list.splice(0, this.list.length), this.pool.splice(0, this.pool.length)
        }
    }
    class Y {
        constructor(e, t = -1, i = -1, s = -1) {
            this.show_duan = -1, this.rid = e, this.son_index = t, this.gson_index = i, this.show_duan = s
        }
        create() {
            let e = H.instance.getCompleteResByID(this.rid),
                t = Laya.loader.getRes(e);
            this.son_index > -1 && (t = t.getChildAt(this.son_index), this.gson_index > -1 && (t = t.getChildAt(this.gson_index)));
            let i = Laya.Sprite3D.instantiate(t);
            return i.mem_rid = this.rid, i.mem_son_index = this.son_index, i.mem_gson_index = this.gson_index, i.mem_show_duan = this.show_duan, i
        }
        getKey() {
            return K.getKey(this.rid, this.son_index, this.gson_index)
        }
    }
    class W extends Laya.Script3D {
        constructor() {
            super()
        }
        onUpdate() {
            this.sp3.transform.setWorldLossyScale(this.scale)
        }
        onEnable() {
            this.sp3 = this.owner, this.scale = this.sp3.transform.getWorldLossyScale().clone(), Laya.Tween.to(this.scale, {
                x: .1 * this.scale.x,
                y: .1 * this.scale.y,
                z: .1 * this.scale.z
            }, 300, null, Laya.Handler.create(this, () => {
                this.destroy()
            }))
        }
        onDisable() {
            this.sp3.transform.setWorldLossyScale(this.scale), K.recoveryComplexSP(this.sp3, !0), Laya.Tween.clearAll(this.scale)
        }
        getDuan(e) {
            return Laya.timer.currTimer - e
        }
        getNow() {
            return Laya.timer.currTimer
        }
    }
    class q {}
    q.null_category = 1, q.road_category = 2, q.obstacle_category = 4, q.prop_category = 8, q.role_cap_category = 256, q.road_mask = 256, q.obstacle_mask = 256, q.prop_mask = 256, q.role_cap_mask = 14,
        function (e) {
            e[e.ATK_EXE = 0] = "ATK_EXE", e[e.BEHURT_EXE = 1] = "BEHURT_EXE", e[e.SKILL_EXE = 2] = "SKILL_EXE", e[e.FSM_ENTER = 3] = "FSM_ENTER", e[e.HALO_BEGIN = 4] = "HALO_BEGIN", e[e.HALO_END = 5] = "HALO_END", e[e.DEM = 6] = "DEM", e[e.WIN = 7] = "WIN", e[e.FAILT = 8] = "FAILT", e[e.ANIM_WALK_HIT = 9] = "ANIM_WALK_HIT", e[e.ANIM_CLAP = 10] = "ANIM_CLAP", e[e.CHANGE_SHOES = 11] = "CHANGE_SHOES"
        }(i || (i = {}));
    class j {
        constructor() {
            this.list = new Array
        }
        add(e) {
            this.list.push(e)
        }
        remove(e) {
            let t = !1;
            if (e)
                for (let i = 0; i < this.list.length; i++) e == this.list[i] && (this.list.splice(i, 1), t = !0);
            return t
        }
        isEmpty() {
            let e = !1;
            return this.list.length <= 0 && (e = !0), e
        }
        run(e, t, i, s, a) {
            for (let n = 0; n < this.list.length; n++) {
                let r = this.list[n];
                null != r && r(e, t, i, s, a)
            }
        }
    }
    class X {
        static OnListenerAdding(e, t) {
            if (!this.m_EventTable.hasKey(e)) {
                let t = new j;
                this.m_EventTable.add(e, t)
            }
        }
        static OnListenerRemoved(e) {
            this.m_EventTable.hasKey(e) && this.m_EventTable.get(e).isEmpty() && this.m_EventTable.remove(e)
        }
        static AddListener(e, t) {
            this.OnListenerAdding(e, t), this.m_EventTable.get(e).add(t)
        }
        static RemoveListener(e, t) {
            this.m_EventTable.hasKey(e) ? (this.m_EventTable.get(e).remove(t), this.OnListenerRemoved(e)) : console.error("不存在事件,请重新注册")
        }
        static BroadCast(e, t, i, s, a, n) {
            let r;
            this.m_EventTable.hasKey(e) ? null != (r = this.m_EventTable.get(e)) && r.run(t, i, s, a, n) : console.error("找不到对应事件码", e, "请重新注册")
        }
    }
    X.m_EventTable = new G;
    class J {
        constructor() {
            J.instance = this
        }
        Enter(e) {
            e.playAnim(At.ANIM_IDLE)
        }
        Execute(e) {}
        Exit(e) {}
    }
    new J;
    class Z {
        constructor() {
            Z.instance = this
        }
        Enter(e) {
            e.closeThighLeftFix(), e.playAnim(At.ANIM_STANDBY), e.broadcastFSMEvent()
        }
        Execute(e) {
            e.move_ctrl.updateVSpeed(0)
        }
        Exit(e) {}
    }
    new Z;
    class Q {
        constructor() {
            Q.instance = this
        }
        Enter(e) {
            if(! window.gameStart){
                return
            }
            e.closeThighLeftFix(), e.playAnim(At.ANIM_RUNNING), e.broadcastFSMEvent()
        }
        Execute(e) {
            if(! window.gameStart){
                return
                            }
            e.move_ctrl.updateVSpeed(e.WALK_SPEED), e.refreshAnimSpeed(), e.move_ctrl.updateREZRunning(), e.refreshCapBodySize()
        }
        Exit(e) {}
    }
    new Q;
    class $ {
        constructor() {
            $.instance = this
        }
        Enter(e) {
            e.closeThighLeftFix(), e.playAnim(At.ANIM_RUNNING_BALANCE), e.broadcastFSMEvent();
            let t = e.BEAM_SPEED * Math.cos(C.degToRad(e.walk_line_beam_rex));
            e.move_ctrl.speed_cur = t
        }
        Execute(e) {
            let t = e.BEAM_SPEED * Math.cos(C.degToRad(e.walk_line_beam_rex));
            e.move_ctrl.updateVSpeed(t), e.refreshAnimSpeed(), e.move_ctrl.updateREZBeamAuto()
        }
        Exit(e) {
            e.move_ctrl.speed_cur = 0, Jt.instance.jsui.resetCenterByCurPoint()
        }
    }
    new $;
    class ee {
        constructor() {
            ee.instance = this
        }
        Enter(e) {
            e.playAnim(At.ANIM_RUNNING_CLAP_START), e.broadcastFSMEvent(), e.dead_stime = e.getNow(), e.role_sp_speed_y = (e.role_sp.transform.position.y - e.role.transform.position.y) / .5, e.changeBodyTypeToBox(), e.openThighFix(), e.rails_speed_cur = e.RAILS_SPEED
        }
        Execute(e) {
            let t = 9.8 * Math.sin(C.degToRad(e.walk_line_rail_rex)) * Laya.timer.delta * .001;
            e.rails_speed_cur += t, e.move_ctrl.updateVSpeed(e.rails_speed_cur, !1, e.walk_line_rail_rex), e.refreshRoleSpHight(0, e.role_sp_speed_y), e.getDuan(e.dead_stime) > 980 && e.mFSMLeg.ChangeState(te.instance)
        }
        Exit(e) {}
    }
    new ee;
    class te {
        constructor() {
            te.instance = this
        }
        Enter(e) {
            let t = [50005];
            H.instance.playSound(t[_.getIntegerInRandom(t.length - 1, 0)], 1), e.playAnim(At.ANIM_RUNNING_CLAP_LOOP), e.broadcastFSMEvent()
        }
        Execute(e) {
            let t = 9.8 * Math.sin(C.degToRad(e.walk_line_rail_rex)) * Laya.timer.delta * .001;
            e.rails_speed_cur += t, e.move_ctrl.updateVSpeed(e.rails_speed_cur, !1, e.walk_line_rail_rex), e.refreshRoleSpHight(0, e.role_sp_speed_y)
        }
        Exit(e) {
            e.closeThighLeftFix(), e.rails_speed_cur = e.RAILS_SPEED, e.move_ctrl.speed_cur = e.RAILS_SPEED
        }
    }
    new te;
    class ie {
        constructor() {
            ie.instance = this
        }
        Enter(e) {
            e.closeThighLeftFix(), e.playAnim(At.ANIM_WIN), e.broadcastFSMEvent()
        }
        Execute(e) {
            e.move_ctrl.updateVSpeed(0, !0)
        }
        Exit(e) {}
    }
    new ie;
    class se {
        constructor() {
            se.instance = this
        }
        Enter(e) {
            e.closeThighLeftFix(), y.is_win = !0, H.instance.playSound(50003, 1), e.playAnim(At.ANIM_WIN_AROUND), e.broadcastFSMEvent(), Jt.instance.playwinRole(), e.dead_stime = e.getNow(), Laya.timer.once(3e3, e, () => {
                Jt.instance.playWinEffect()
            })
        }
        Execute(e) {
            e.getDuan(e.dead_stime) < e.SUPER_WIN_WALK_DUAN ? e.move_ctrl.updateVSpeed(e.SUPER_WIN_WALK_SPEED, !0) : e.mFSMLeg.ChangeState(ae.instance)
        }
        Exit(e) {}
    }
    new se;
    class ae {
        constructor() {
            ae.instance = this
        }
        Enter(e) {
            e.closeThighLeftFix(), Jt.instance.playwinRole(), H.instance.playSound(50003, 1), e.playAnim(At.ANIM_WIN), e.broadcastFSMEvent(), Laya.timer.once(1e3, e, () => {
                X.BroadCast(i.WIN, 6)
            })
        }
        Execute(e) {
            e.move_ctrl.updateVSpeed(0, !0)
        }
        Exit(e) {}
    }
    new ae;
    class ne {
        constructor() {
            ne.instance = this
        }
        Enter(e) {
            e.closeThighLeftFix(), e.playAnim(At.ANIM_DEAD), e.broadcastFSMEvent(), e.dead_stime = e.getNow()
        }
        Execute(e) {
            e.move_ctrl.updateVSpeed(0, !0), e.refreshCapBodySize()
        }
        Exit(e) {}
    }
    new ne;
    class re {
        constructor() {
            re.instance = this
        }
        Enter(e) {
            e.broadcastFSMEvent(), K.recoverySP(e.role)
        }
        Execute(e) {}
        Exit(e) {}
    }
    new re;
    class oe {
        constructor() {
            oe.instance = this
        }
        Enter(e) {
            e.is_can_revive = !1, e.broadcastFSMEvent()
        }
        Execute(e) {
            e.mFSMLeg.ChangeState(Z.instance)
        }
        Exit(e) {}
    }
    new oe;
    class le extends Laya.Script3D {
        constructor() {
            super(), this.equip_list = new Array, this.para_bill = new ce
        }
        onUpdate() {
            this.equip_list.forEach(e => {
                e.onUpdate()
            })
        }
        onEnable() {
            this.role = this.owner
        }
        onDisable() {}
        onDestroy() {
            this.equip_list.forEach(e => {
                this.takeOffEquip(e)
            }), this.equip_list.splice(0, this.equip_list.length), this.getParaBill()
        }
        initValue(e, t = {}) {
            this.mSysINF = e, this.role_script = this.role.getComponent(At)
        }
        wearEquip(e) {
            let t = this.getWearEquipByTypeID(e.type_id);
            if (t) {
                if (e.equip_id == t.equip_id) return;
                this.takeOffEquip(t), m.changeEquipState(t.equip_id, 0)
            }
            e.mSys = this, this.equip_list.push(e), e.onEnable(), m.changeEquipState(e.equip_id, 1, !0), this.getParaBill()
        }
        takeOffEquip(e) {
            let t = this.equip_list.indexOf(e);
            t > -1 && (e.onDisable(), e.mSys = null, this.equip_list.splice(t, 1), this.getParaBill())
        }
        hasWearEquip(e) {
            return -1 != this.equip_list.indexOf(e)
        }
        getWearEquip(e) {
            for (let t = 0; t < this.equip_list.length; t++) {
                let i = this.equip_list[t];
                if (i.equip_id == e) return i
            }
            return null
        }
        getWearEquipByTypeID(e) {
            for (let t = 0; t < this.equip_list.length; t++) {
                let i = this.equip_list[t];
                if (i.type_id == e) return i
            }
            return null
        }
        getParaBill() {
            this.para_bill.reset(), this.equip_list.forEach(e => {
                this.para_bill.add(e.main_para), e.assist_para.forEach(e => {
                    this.para_bill.add(e)
                })
            })
        }
    }
    class he {
        constructor() {
            this.hp_value = 0, this.hp_rate = 0, this.miss_rate = 0, this.hit_rate = 0, this.rda_value = 0, this.rda_rate = 0, this.atk_value = 0, this.atk_rate = 0, this.atk_skill_value = 0, this.atk_skill_rate = 0, this.atk_speed_rate = 0, this.crit_rate = 0, this.crit_atk_rate = 0, this.move_speed_value = 0, this.move_speed_rate = 0, this.gold_get_value = 0, this.gold_get_rate = 0, this.exp_get_value = 0, this.exp_get_rate = 0, this.reset()
        }
        setAllPara(e = {}) {
            he.KEY_LIST.forEach(t => {
                this.setParaOne(e, t)
            })
        }
        setParaOne(e = {}, t) {
            null != e[t] && (this[t] = e[t])
        }
        setParaDefault(e = {}, t, i) {
            null == e[t] && (this[t] = i)
        }
        reset() {
            he.KEY_LIST.forEach(e => {
                this[e] = 0
            })
        }
        add(e) {
            he.KEY_LIST.forEach(t => {
                this[t] = this[t] + e[t]
            })
        }
        static getParaBill(e) {}
        static getReviseValue(e, t, i) {
            if (t == this.RV_RDA) return Math.max(0, this.formulaFirstSubThenMul(e, t, i));
            if (t == this.RV_MISS_RATE || t == this.RV_HIT_RATE || t == this.RV_CRIT_RATE || t == this.RV_CRIT_ATK_RATE || t == this.RV_ATK_SPEED_RATE) {
                let s = Math.max(0, this.formulaAdd(e, t, i));
                return t == this.RV_ATK_SPEED_RATE && (s = Math.max(1e-5, s)), s
            } {
                let s = this.formulaFirstMulThenAdd(e, t, i);
                return t == this.RV_MOVE_SPEED && (s = Math.max(1e-5, s)), t != this.RV_GOLD_GET && t != this.RV_EXP_GET || (s = Math.round(s)), s
            }
        }
        static formulaFirstSubThenMul(e, t, i) {
            let s = this.getParaBill(e);
            if (s) {
                let e = s[t + "_rate"];
                e = null == e ? 1 : 1 - e;
                let a = s[t + "_value"];
                return (i - (a = null == a ? 0 : a)) * e
            }
            return i
        }
        static formulaFirstMulThenAdd(e, t, i) {
            let s = this.getParaBill(e);
            if (s) {
                let e = s[t + "_rate"];
                e = null == e ? 1 : 1 + e;
                let a = s[t + "_value"];
                return i * e + (a = null == a ? 0 : a)
            }
            return i
        }
        static formulaAdd(e, t, i) {
            let s = this.getParaBill(e);
            return s ? i + s[t] : i
        }
        static toCN(e) {
            switch (e) {
                case this.KEY_HP_VALUE:
                case this.KEY_HP_RATE:
                    return "生命值";
                case this.KEY_RDA_VALUE:
                case this.KEY_RDA_RATE:
                    return "减少伤害";
                case this.KEY_MISS_RATE:
                    return "回避率";
                case this.KEY_HIT_RATE:
                    return "命中率";
                case this.KEY_ATK_VALUE:
                case this.KEY_ATK_RATE:
                    return "普通伤害";
                case this.KEY_ATK_SKILL_VALUE:
                case this.KEY_ATK_SKILL_RATE:
                    return "技能伤害";
                case this.KEY_ATK_SPEED_RATE:
                    return "攻击速度";
                case this.KEY_CRIT_RATE:
                    return "暴击率";
                case this.KEY_CRIT_ATK_RATE:
                    return "暴击伤害";
                case this.KEY_MOVE_SPEED_VALUE:
                case this.KEY_MOVE_SPEED_RATE:
                    return "移动速度";
                case this.KEY_GOLD_GET_VALUE:
                case this.KEY_GOLD_GET_RATE:
                    return "金币获得";
                case this.KEY_EXP_GET_VALUE:
                case this.KEY_EXP_GET_RATE:
                    return "经验获得"
            }
        }
    }
    he.RV_HP = "hp", he.RV_RDA = "rda", he.RV_MISS_RATE = "miss_rate", he.RV_HIT_RATE = "hit_rate", he.RV_ATK = "atk", he.RV_ATK_SKILL = "atk_skill", he.RV_ATK_SPEED_RATE = "atk_speed_rate", he.RV_CRIT_RATE = "crit_rate", he.RV_CRIT_ATK_RATE = "crit_atk_rate", he.RV_MOVE_SPEED = "move_speed", he.RV_GOLD_GET = "gold_get", he.RV_EXP_GET = "exp_get", he.KEY_HP_VALUE = "hp_value", he.KEY_HP_RATE = "hp_rate", he.KEY_RDA_VALUE = "rda_value", he.KEY_RDA_RATE = "rda_rate", he.KEY_MISS_RATE = "miss_rate", he.KEY_HIT_RATE = "hit_rate", he.KEY_ATK_VALUE = "atk_value", he.KEY_ATK_RATE = "atk_rate", he.KEY_ATK_SKILL_VALUE = "atk_skill_value", he.KEY_ATK_SKILL_RATE = "atk_skill_rate", he.KEY_ATK_SPEED_RATE = "atk_speed_rate", he.KEY_CRIT_RATE = "crit_rate", he.KEY_CRIT_ATK_RATE = "crit_atk_rate", he.KEY_MOVE_SPEED_VALUE = "move_speed_value", he.KEY_MOVE_SPEED_RATE = "move_speed_rate", he.KEY_GOLD_GET_VALUE = "gold_get_value", he.KEY_GOLD_GET_RATE = "gold_get_rate", he.KEY_EXP_GET_VALUE = "exp_get_value", he.KEY_EXP_GET_RATE = "exp_get_rate", he.KEY_LIST = [he.KEY_HP_VALUE, he.KEY_HP_RATE, he.KEY_RDA_VALUE, he.KEY_RDA_RATE, he.KEY_MISS_RATE, he.KEY_ATK_VALUE, he.KEY_ATK_RATE, he.KEY_ATK_SKILL_VALUE, he.KEY_ATK_SKILL_RATE, he.KEY_ATK_SPEED_RATE, he.KEY_CRIT_RATE, he.KEY_CRIT_ATK_RATE, he.KEY_HIT_RATE, he.KEY_MOVE_SPEED_VALUE, he.KEY_MOVE_SPEED_RATE, he.KEY_GOLD_GET_VALUE, he.KEY_GOLD_GET_RATE, he.KEY_EXP_GET_VALUE, he.KEY_EXP_GET_RATE];
    class ce extends he {
        static getParaBill(e) {
            let t = e.role.getComponent(le);
            if (t) return t.para_bill
        }
        getPara() {
            for (let e = 0; e < he.KEY_LIST.length; e++) {
                let t = he.KEY_LIST[e];
                if (0 != this[t]) return {
                    k: t,
                    v: this[t]
                }
            }
        }
    }
    class de {
        constructor() {
            this.mStateMachine = new b(this), this.setEventBus()
        }
        setEventBus() {
            this.func_atkExeEvent = this.atkExeEvent.bind(this), X.AddListener(i.ATK_EXE, this.func_atkExeEvent), this.func_behurtExeEvent = this.behurtExeEvent.bind(this), X.AddListener(i.BEHURT_EXE, this.func_behurtExeEvent), this.func_skillExeEvent = this.skillExeEvent.bind(this), X.AddListener(i.SKILL_EXE, this.func_skillExeEvent), this.func_fsmEnterEvent = this.fsmEnterEvent.bind(this), X.AddListener(i.FSM_ENTER, this.func_fsmEnterEvent)
        }
        onEnable() {}
        remove() {
            X.RemoveListener(i.ATK_EXE, this.func_atkExeEvent), X.RemoveListener(i.BEHURT_EXE, this.func_behurtExeEvent), X.RemoveListener(i.SKILL_EXE, this.func_skillExeEvent), X.RemoveListener(i.FSM_ENTER, this.func_fsmEnterEvent)
        }
        onDisable() {
            this.remove()
        }
        setParaOne(e = {}, t) {
            null != e[t] && (this[t] = e[t])
        }
        onUpdate() {
            this.mStateMachine.Update()
        }
        GetFSM() {
            return this.mStateMachine
        }
        getDuan(e) {
            return Laya.timer.currTimer - e
        }
        getNow() {
            return Laya.timer.currTimer
        }
        atkExeEvent(e, t, i) {}
        behurtExeEvent(e, t, i) {}
        skillExeEvent(e) {}
        fsmEnterEvent(e, t) {}
    }
    class _e extends de {
        constructor(e, t = {}) {
            super(), this.buff_id = -1, this.stack_num_limit = 10, this.is_show_ui = !0, this.is_dead_remove = !0, this.active_duan = 8e3, this.atk_count = 1, this.buff_stack_num = 1, this.buff_stime = 0, this.atk_exe_stime = 0, this.buff_used_time = 0, this.atk_index = 0, this.atk_div = 0, this.mSkillSys = e, this.para_input = t, this.setParaOne(t, "active_duan"), this.setParaOne(t, "atk_count"), this.setParaOne(t, "stack_num_limit"), this.setParaOne(t, "is_show_ui"), this.para = new Xe, this.para.setAllPara(t)
        }
        activeBuff(e) {
            this.act_role = e, this.GetFSM().ChangeState(ue.instance)
        }
        resetParam() {
            this.buff_stime = 0, this.atk_exe_stime = 0, this.buff_used_time = 0, this.atk_index = 0, this.atk_div = this.active_duan / this.atk_count
        }
        readyEnter() {}
        activeEnter() {}
        isFinish() {
            return !(!this.GetFSM().isInState(pe.instance) && !this.GetFSM().isInState(me.instance))
        }
        refreshUsedTime() {
            this.buff_used_time = this.getDuan(this.buff_stime), this.buff_used_time = this.buff_used_time > this.active_duan ? this.active_duan : this.buff_used_time
        }
        destroy() {
            this.mSkillSys.removeBuff(this)
        }
        clone() {
            return qe.getNewBuffByID(this.mSkillSys, this.buff_id, this.para_input)
        }
    }
    _e.BUFF_ID = -1;
    class me {
        constructor() {
            me.instance = this
        }
        Enter(e) {}
        Execute(e) {}
        Exit(e) {}
    }
    new me;
    class ue {
        constructor() {
            ue.instance = this
        }
        Enter(e) {
            e.resetParam(), e.buff_stime = e.getNow(), e.readyEnter(), e.GetFSM().ChangeState(ge.instance)
        }
        Execute(e) {
            e.refreshUsedTime()
        }
        Exit(e) {}
    }
    new ue;
    class ge {
        constructor() {
            ge.instance = this
        }
        Enter(e) {
            e.atk_exe_stime = e.getNow(), e.atk_index++, e.activeEnter()
        }
        Execute(e) {
            e.refreshUsedTime(), e.getNow() - e.atk_exe_stime >= e.atk_div && (e.atk_index < e.atk_count ? e.GetFSM().ChangeState(ge.instance) : e.GetFSM().ChangeState(pe.instance))
        }
        Exit(e) {}
    }
    new ge;
    class pe {
        constructor() {
            pe.instance = this
        }
        Enter(e) {
            e.refreshUsedTime(), e.destroy()
        }
        Execute(e) {}
        Exit(e) {}
    }
    new pe;
    class fe extends _e {
        constructor(e, t = {}, i) {
            super(e, t), this.is_apply_friends = !0, this.halo_radius = 10, this.apply_buff_temp = i, this.stack_num_limit = 1, this.setParaOne(t, "halo_radius")
        }
        onUpdate() {
            if (super.onUpdate(), !this.halo_body) return;
            if (!this.halo_body.enabled) return;
            let e = this.mSkillSys.role.transform.position;
            this.halo.transform.position = e.clone()
        }
        destroy() {
            super.destroy(), this.halo_body && (this.halo_body.destroy(), K.recoverySP(this.halo))
        }
        readyEnter() {
            if (super.readyEnter(), this.mSkillSys.role.id != this.act_role.id) return;
            this.halo = new Laya.Sprite3D, this.halo.name = "halo", this.mSkillSys.role.addChild(this.halo);
            let e = this.mSkillSys.role.transform.position;
            this.halo.transform.localPosition = new Laya.Vector3(e.x, .01, e.z), this.halo_body = this.halo.addComponent(Laya.Rigidbody3D);
            let t = new Laya.SphereColliderShape(this.halo_radius);
            this.halo_body.colliderShape = t, this.halo_body.isTrigger = !0, this.halo_body.isKinematic = !0;
            let i = K.getSP(4001);
            this.halo.addChild(i), i.transform.rotationEuler = new Laya.Vector3(90, 0, 0), i.transform.setWorldLossyScale(new Laya.Vector3(this.halo_radius, 2 * this.halo_radius, this.halo_radius)), this.setSelfEventBus()
        }
        setSelfEventBus() {}
        remove() {
            super.remove(), this.halo_body && (this.halo_body.destroy(), Laya.timer.once(1, this, () => {
                X.RemoveListener(i.HALO_BEGIN, this.func_haloBegin), X.RemoveListener(i.HALO_END, this.func_haloEnd)
            }))
        }
    }
    class ye extends fe {
        constructor(e, t = {}) {
            super(e, t, new Se(e, t)), this.img_icon = "comp/halo_icon_atk_rate_up.png", this.is_apply_friends = !0, this.buff_id = ye.BUFF_ID, this.buff_name = "强击光环", this.para.setParaDefault(t, he.KEY_ATK_RATE, .1), null == t.active_duan && (this.active_duan = 1e4)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    ye.BUFF_ID = 90001;
    class Se extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/halo_icon_atk_rate_up.png", this.buff_id = Se.BUFF_ID, this.buff_name = "强击光环Buff", this.para.setParaDefault(t, he.KEY_ATK_RATE, .1), this.active_duan = Number.MAX_VALUE, this.stack_num_limit = 1
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    Se.BUFF_ID = 90002;
    class be extends fe {
        constructor(e, t = {}) {
            super(e, t, new Ee(e, t)), this.img_icon = "comp/halo_icon_blood_sucking.png", this.is_apply_friends = !0, this.buff_id = be.BUFF_ID, this.buff_name = "吸血光环", null == t.active_duan && (this.active_duan = 1e4)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    be.BUFF_ID = 110001;
    class Ee extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/halo_icon_blood_sucking.png", this.buff_id = Ee.BUFF_ID, this.buff_name = "吸血光环Buff", this.active_duan = Number.MAX_VALUE, this.stack_num_limit = 1
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
        behurtExeEvent(e, t, i) {
            if (super.behurtExeEvent(e, t, i), e.id != this.mSkillSys.role.id) return;
            if (i.type == et.TYPE_REVIVE || i.type == et.TYPE_CURE) return;
            let s = new et(e);
            s.type = et.TYPE_CURE, s.complete = -.3 * i.real, this.mSkillSys.role_script.behert(e, s, !0)
        }
    }
    Ee.BUFF_ID = 110002;
    class Ae {
        constructor(e, t, i, s) {
            this.damage = e, this.shape = t, this.hit_fly = i, this.role_action = s, this.hit_buff_list = new Array
        }
        pushHitBuff(e) {
            this.hit_buff_list.push(e)
        }
        removeAllHitBuff() {
            this.hit_buff_list.splice(0, this.hit_buff_list.length)
        }
        setHitFly(e) {
            this.hit_fly = e
        }
        removeHitFly() {
            this.hit_fly = null
        }
    }
    class Le {
        getRate(e, t, i) {
            return 0
        }
    }
    class Ce extends Le {
        getRate(e, t, i) {
            return super.getRate(), 1
        }
    }
    class ve extends Le {
        constructor(e, t) {
            super(), this.radius = 2, this.radius = e, this.damageFunc = t
        }
        getRate(e, t, i) {
            return super.getRate(), this.damageFunc == ve.NORMAL_DMG ? this.normalDMG(e, t, i) : this.downDMG(e, t, i)
        }
        normalDMG(e, t, i) {
            return v.distance2DXZ(e, t) - i <= this.radius ? 1 : 0
        }
        downDMG(e, t, i) {
            return v.distance2DXZ(e, t) - i <= this.radius ? 1 : 0
        }
    }
    ve.NORMAL_DMG = "normal_dmg", ve.DOWN_DMG = "down_dmg";
    class we extends fe {
        constructor(e, t = {}) {
            super(e, t, new Ie(e, t)), this.img_icon = "comp/halo_icon_corrosion.png", this.is_apply_friends = !1, this.buff_id = we.BUFF_ID, this.buff_name = "腐蚀光环", null == t.active_duan && (this.active_duan = 1e4)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    we.BUFF_ID = 100001;
    class Ie extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/halo_icon_corrosion.png", this.buff_id = Ie.BUFF_ID, this.buff_name = "腐蚀光环Buff", null == t.active_duan && (this.active_duan = 864e5), null == t.atk_count && (this.atk_count = Math.round(this.active_duan / 200) + 1);
            let i = new Ce,
                s = null == t.skill_atk ? 5 : t.skill_atk,
                a = new et(this.mSkillSys.role, this);
            a.setValue(s, et.TYPE_SKILL), this.skill_action_0 = new Ae(a, i), this.stack_num_limit = 1
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter(), this.mSkillSys.buffActionEXE(this, this.skill_action_0)
        }
    }
    Ie.BUFF_ID = 100002;
    class Te extends fe {
        constructor(e, t = {}) {
            super(e, t, new xe(e, t)), this.img_icon = "comp/halo_icon_move_speed_down.png", this.is_apply_friends = !1, this.buff_id = Te.BUFF_ID, this.buff_name = "减速光环", null == t.active_duan && (this.active_duan = 1e4)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    Te.BUFF_ID = 80001;
    class xe extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/halo_icon_move_speed_down.png", this.buff_id = xe.BUFF_ID, this.buff_name = "减速光环DeBuff", this.para.setParaDefault(t, he.KEY_MOVE_SPEED_RATE, -.9), this.active_duan = Number.MAX_VALUE, this.stack_num_limit = 1
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    xe.BUFF_ID = 80002;
    class ke extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/buff_icon_atk_rate_up.png", this.buff_id = ke.BUFF_ID, this.para.setParaDefault(t, Xe.KEY_ATK_RATE, .1), this.para.setParaDefault(t, "active_duan", 5e3)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    ke.BUFF_ID = 10001;
    class Be extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/buff_icon_atk_speed_rate_up.png", this.buff_id = Be.BUFF_ID, this.para.setParaDefault(t, "atk_speed_rate", .09), this.para.setParaDefault(t, "active_duan", 5e3)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    Be.BUFF_ID = 10002;
    class Re extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/buff_icon_atk_rate_up.png", this.buff_id = Re.BUFF_ID, this.para.setParaDefault(t, Xe.KEY_HP_RATE, .1), this.para.setParaDefault(t, "active_duan", 5e3)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    Re.BUFF_ID = 60001;
    class Me extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/buff_icon_speed_rate_up.png", this.buff_id = Me.BUFF_ID, this.para.setParaDefault(t, "move_speed_rate", .15), this.para.setParaDefault(t, "active_duan", 1e4)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    Me.BUFF_ID = 10003;
    class De extends de {
        constructor(e) {
            super(), this.skill_id = -1, this.atk = 1, this.sk_ready_duan = 200, this.sk_cd = 2e3, this.skill_stime = 0, this.atk_exe_stime = 0, this.skill_used_time = 0, this.used_index = 0, this.atk_index = 0, this.mSkillSys = e
        }
        onEnable() {
            this.GetFSM().SetCurrentState(Pe.instance)
        }
        resetParam() {
            this.skill_stime = 0, this.skill_used_time = 0, this.atk_exe_stime = 0, this.atk_index = 0
        }
        exeSkill() {
            X.BroadCast(i.SKILL_EXE, this)
        }
        breakSkill() {
            this.GetFSM().getCurrentState() instanceof Ne && this.goCDing()
        }
        resetCD() {
            this.GetFSM().getCurrentState() instanceof Ue && (this.skill_stime = this.getNow() - 9999999, this.skill_used_time = this.getDuan(this.skill_stime))
        }
        goReady() {
            this.getDuan(this.skill_stime) >= this.sk_cd && this.GetFSM().ChangeState(this.fsm_ready)
        }
        goCDing() {
            this.GetFSM().ChangeState(this.fsm_cding)
        }
        getSkillEXECenter() {
            return this.target_role && !this.target_role.destroyed ? this.target_role.transform.position : this.target_pos ? this.target_pos : this.mSkillSys.role.transform.position
        }
        isCDFinish() {
            return !(!this.GetFSM().isInState(Ve.instance) && !this.GetFSM().isInState(Pe.instance))
        }
        refreshUsedTime() {
            this.skill_used_time = this.getDuan(this.skill_stime), this.skill_used_time = this.skill_used_time > this.sk_cd ? this.sk_cd : this.skill_used_time, this.mSkillSys.skillStateUpdate(this)
        }
    }
    De.SKILL_ID = -1;
    class Pe {
        constructor() {
            Pe.instance = this
        }
        Enter(e) {}
        Execute(e) {}
        Exit(e) {}
    }
    new Pe;
    class Ne {
        Enter(e) {
            e.resetParam(), e.skill_stime = e.getNow()
        }
        Execute(e) {
            e.refreshUsedTime()
        }
        Exit(e) {}
    }
    class Oe {
        Enter(e) {
            e.atk_exe_stime = e.getNow(), 0 == e.atk_index && e.used_index++
        }
        Execute(e) {
            e.refreshUsedTime()
        }
        Exit(e) {}
    }
    class Ue {
        Enter(e) {}
        Execute(e) {
            e.refreshUsedTime(), e.skill_used_time >= e.sk_cd && e.GetFSM().ChangeState(Ve.instance)
        }
        Exit(e) {}
    }
    class Ve {
        constructor() {
            Ve.instance = this
        }
        Enter(e) {
            e.refreshUsedTime()
        }
        Execute(e) {}
        Exit(e) {}
    }
    new Ve;
    class Fe extends De {
        constructor(e, t = {}) {
            super(e), this.skill_id = Fe.SKILL_ID;
            let i = new Ce;
            this.sk_ready_duan = null == t.sk_ready_duan ? 3e3 : t.sk_ready_duan, this.sk_cd = null == t.sk_cd ? 1e4 : t.sk_cd;
            let s = null == t.skill_atk ? -50 : t.skill_atk,
                a = new et(this.mSkillSys.role, this);
            a.setValue(s, et.TYPE_REVIVE), this.skill_action_0 = new Ae(a, i), this.target_role = this.mSkillSys.role, this.fsm_ready = He.instance, this.fsm_cding = Ke.instance
        }
        exeSkill() {
            super.exeSkill(), this.goReady()
        }
    }
    Fe.SKILL_ID = 50001;
    class He extends Ne {
        constructor() {
            super(), He.instance = this
        }
        Enter(e) {
            super.Enter(e), e.mSkillSys.playRoleAnim("xxxxx")
        }
        Execute(e) {
            super.Execute(e), e.skill_used_time < e.sk_ready_duan || e.GetFSM().ChangeState(Ge.instance)
        }
        Exit(e) {}
    }
    new He;
    class Ge extends Oe {
        constructor() {
            super(), Ge.instance = this
        }
        Enter(e) {
            super.Enter(e), e.mSkillSys.skillActionEXE(e, e.skill_action_0), e.GetFSM().ChangeState(Ke.instance)
        }
        Execute(e) {}
    }
    new Ge;
    class Ke extends Ue {
        constructor() {
            super(), Ke.instance = this
        }
        Enter(e) {
            super.Enter(e), e.mSkillSys.removeSkill(e)
        }
    }
    new Ke;
    class ze extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/buff_icon_revive.png", this.buff_id = ze.BUFF_ID, this.buff_name = "复活Buff", null == t.active_duan && (this.active_duan = 6e5), this.atk_count = 2, this.stack_num_limit = 1, this.is_dead_remove = !1, this.skill_revive = new Fe(this.mSkillSys), this.mSkillSys.pushSkill(this.skill_revive)
        }
        readyEnter() {
            super.readyEnter();
            let e = this.mSkillSys.role_script;
            e && (e.is_can_revive = !0, this.atk_div = this.active_duan)
        }
        activeEnter() {
            super.activeEnter(), 1 != this.atk_index && (this.skill_revive.target_role = this.mSkillSys.role, this.skill_revive.exeSkill(), this.GetFSM().ChangeState(pe.instance))
        }
        fsmEnterEvent(e, t) {
            if (super.fsmEnterEvent(e, t), this.mSkillSys.role.id != e.id) return;
            if (!(t instanceof ne)) return;
            this.mSkillSys.role_script.is_can_revive && this.GetFSM().ChangeState(ge.instance)
        }
    }
    ze.BUFF_ID = 30001;
    class Ye extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/buff_icon_ice.png", this.buff_id = Ye.BUFF_ID, this.buff_name = "冰冻Buff", this.para.setParaDefault(t, "atk_speed_rate", -.99), this.para.setParaDefault(t, "move_speed_rate", -.99), null == t.active_duan && (this.active_duan = 2e3)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter()
        }
    }
    Ye.BUFF_ID = 20002;
    class We extends _e {
        constructor(e, t = {}) {
            super(e, t), this.img_icon = "comp/buff_icon_poison.png", this.buff_id = We.BUFF_ID, this.buff_name = "毒Buff", this.para.setParaDefault(t, "move_speed_rate", -.15), null == t.active_duan && (this.active_duan = 15e3), null == t.atk_count && (this.atk_count = Math.round(5) + 1);
            let i = new Ce,
                s = null == t.skill_atk ? 12 : t.skill_atk,
                a = new et(this.mSkillSys.role, this);
            a.setValue(s, et.TYPE_SKILL), this.skill_action_0 = new Ae(a, i)
        }
        readyEnter() {
            super.readyEnter()
        }
        activeEnter() {
            super.activeEnter(), this.mSkillSys.buffActionEXE(this, this.skill_action_0)
        }
    }
    We.BUFF_ID = 20001;
    class qe {
        static getNewBuffByID(e, t, i = {}) {
            let s;
            switch (t) {
                case ke.BUFF_ID:
                    s = new ke(e, i);
                    break;
                case Be.BUFF_ID:
                    s = new Be(e, i);
                    break;
                case Me.BUFF_ID:
                    s = new Me(e, i);
                    break;
                case We.BUFF_ID:
                    s = new We(e, i);
                    break;
                case Ye.BUFF_ID:
                    s = new Ye(e, i);
                    break;
                case ze.BUFF_ID:
                    s = new ze(e, i);
                    break;
                case Re.BUFF_ID:
                    s = new Re(e, i);
                    break;
                case ye.BUFF_ID:
                    s = new ye(e, i);
                    break;
                case Se.BUFF_ID:
                    s = new Se(e, i);
                    break;
                case Te.BUFF_ID:
                    s = new Te(e, i);
                    break;
                case xe.BUFF_ID:
                    s = new xe(e, i);
                    break;
                case we.BUFF_ID:
                    s = new we(e, i);
                    break;
                case Ie.BUFF_ID:
                    s = new Ie(e, i);
                    break;
                case be.BUFF_ID:
                    s = new be(e, i);
                    break;
                case Ee.BUFF_ID:
                    s = new Ee(e, i)
            }
            return s
        }
    }
    class je extends Laya.Script3D {
        constructor() {
            super(), this.skill_list = new Array, this.buff_mat = new Array, this.ui_buff_list = new Array, this.buff_para_bill = new Xe
        }
        onUpdate() {
            this.skill_list.forEach(e => {
                e.onUpdate()
            }), this.buff_mat.forEach(e => {
                e.forEach(e => {
                    e.onUpdate()
                })
            }), this.buffsStateUpdate()
        }
        onEnable() {
            this.role = this.owner, this.func_fsmEnterEvent = this.fsmEnterEvent.bind(this), X.AddListener(i.FSM_ENTER, this.func_fsmEnterEvent)
        }
        onDisable() {
            X.RemoveListener(i.FSM_ENTER, this.func_fsmEnterEvent)
        }
        onDestroy() {
            this.skill_list.forEach(e => {
                e.remove()
            }), this.skill_list.splice(0, this.skill_list.length), this.buff_mat.forEach(e => {
                e.forEach(e => {
                    e.remove()
                }), e.splice(0, e.length)
            }), this.buff_mat.splice(0, this.buff_mat.length), this.ui_buff_list.splice(0, this.ui_buff_list.length), this.getParaBill()
        }
        initValue(e, t = {}) {
            this.mSkillSysINF = e, this.role_script = this.role.getComponent(At)
        }
        pushSkill(e) {
            for (let t = 0; t < this.skill_list.length; t++) {
                let i = this.skill_list[t];
                if (i.skill_id == e.skill_id) {
                    this.removeSkill(i);
                    break
                }
            }
            this.skill_list.push(e)
        }
        exeSkill(e) {
            let t = this.getSkillScriptByID(e);
            t && t.exeSkill()
        }
        getSkillScriptByID(e) {
            for (let t = 0; t < this.skill_list.length; t++)
                if (this.skill_list[t].skill_id == e) return this.skill_list[t]
        }
        removeSkill(e) {
            let t = this.skill_list.indexOf(e);
            e.remove(), t > -1 && this.skill_list.splice(t, 1)
        }
        actBuff(e, t, i = {}) {
            let s = qe.getNewBuffByID(this, t, i);
            s && (this.pushBuff(s), s.activeBuff(e))
        }
        actSkillActionBuff(e) {
            let t = e.mSkillSys.role;
            e.mSkillSys = this, this.pushBuff(e), e.activeBuff(t)
        }
        skillActionEXE(e, t) {
            this.mSkillSysINF.roleSkillAction(this, e, t)
        }
        skillStateUpdate(e) {
            this.mSkillSysINF.skillStateUpdate(this, e)
        }
        playRoleAnim(e) {
            this.role_script.playAnim(e)
        }
        buffActionEXE(e, t) {
            this.mSkillSysINF.roleBuffAction(this, e, t)
        }
        removeBuff(e) {
            for (let t = 0; t < this.buff_mat.length; t++) {
                let i = this.buff_mat[t],
                    s = i.indexOf(e);
                if (s > -1) {
                    e.remove(), i.splice(s, 1), 0 == i.length && this.buff_mat.splice(t, 1);
                    break
                }
            }
        }
        removeBuffByID(e, t) {
            for (let i = 0; i < this.buff_mat.length; i++) {
                let s = this.buff_mat[i];
                if (0 != s.length && s[0].buff_id == e) {
                    s.forEach(e => {
                        if (t && e.act_role)
                            if (e.act_role.id == t.id) {
                                e.remove(), s.indexOf(e) > -1 && s.splice(s.indexOf(e), 1)
                            } else {
                                e.remove(), s.indexOf(e) > -1 && s.splice(s.indexOf(e), 1)
                            }
                    }), 0 == s.length && this.buff_mat.splice(i, 1);
                    break
                }
            }
        }
        removeAllBuffs(e = !0) {
            for (let t = 0; t < this.buff_mat.length; t++) {
                let i = this.buff_mat[t];
                0 != i.length && ((this.getLastBuff(i).is_dead_remove || e) && (i.forEach(e => {
                    e.remove()
                }), i.splice(0, i.length)))
            }
            this.buff_mat.forEach(e => {
                let t = this.buff_mat.indexOf(e);
                t > -1 && 0 == e.length && this.buff_mat.splice(t, 1)
            })
        }
        buffsStateUpdate() {
            this.ui_buff_list.splice(0, this.ui_buff_list.length);
            for (let e = 0; e < this.buff_mat.length; e++) {
                let t = this.buff_mat[e];
                if (0 == t.length) continue;
                let i = this.getLastBuff(t);
                i.is_show_ui && (i.buff_stack_num = t.length, this.ui_buff_list.push(i))
            }
            this.getParaBill(), this.mSkillSysINF.buffsStateUpdate(this, this.ui_buff_list)
        }
        getLastBuff(e) {
            return e[e.length - 1]
        }
        pushBuff(e) {
            for (let t = 0; t < this.buff_mat.length; t++) {
                let i = this.buff_mat[t],
                    s = this.getLastBuff(i);
                if (e.buff_id == s.buff_id) {
                    if (i.length >= e.stack_num_limit) {
                        i.shift().remove()
                    }
                    return void i.push(e)
                }
            }
            let t = new Array;
            t.push(e), this.buff_mat.push(t)
        }
        getParaBill() {
            this.buff_para_bill.reset(), this.buff_mat.forEach(e => {
                e.forEach(e => {
                    this.buff_para_bill.add(e.para)
                })
            })
        }
        fsmEnterEvent(e, t) {
            this.role.id == e.id && t instanceof ne && this.removeAllBuffs(!1)
        }
        static roleSkillAction(e, t, i) {
            let s = i.damage,
                a = t.getSkillEXECenter(),
                n = i.shape;
            if (n)
                if (n instanceof Ce) {
                    let a = n.getRate();
                    if (0 == a) return;
                    let r = At.isCanBehurt(t.target_role, s.type);
                    if (!r) return;
                    this.actDamage(e.role, r, s, a), this.actHitBuff(r, i), this.actHitFly(e.role, r, i)
                } else this.checkTargetRoleV2(e, s, !0, this, t => {
                    let r = n.getRate(a, t.role.transform.position, t.body_radius);
                    0 != r && (this.actDamage(e.role, t, s, r), this.actHitBuff(t, i), this.actHitFly(e.role, t, i))
                })
        }
        static checkTargetRoleV2(e, t, i, s, a) {
            let n = e.role_script.mArmy;
            i ? n.getEnemys(e.role, s, e => {
                let i = At.isCanBehurt(e, t.type);
                i && a.call(s, i)
            }) : n.getFriends(e.role, s, e => {
                let i = At.isCanBehurt(e, t.type);
                i && a.call(s, i)
            })
        }
        static actDamage(e, t, i, s) {
            0 != i.real && s > 0 && (i.updateCompleteByAOERate(s), t.behert(e, i))
        }
        static actHitBuff(e, t) {
            let i = e.role.getComponent(je);
            i && t.hit_buff_list.forEach(e => {
                i.actSkillActionBuff(e)
            })
        }
        static actHitFly(e, t, i) {
            i.hit_fly
        }
        static roleBuffAction(e, t, i) {
            let s = i.damage,
                a = e.role.transform.position.clone(),
                n = i.shape;
            if (n)
                if (n instanceof Ce) {
                    let i = n.getRate();
                    if (0 == i) return;
                    let a = At.isCanBehurt(e.role, s.type);
                    if (!a) return;
                    this.actDamage(t.act_role, a, s, i)
                } else this.checkTargetRoleV2(e, s, !1, this, e => {
                    let i = n.getRate(a, e.role.transform.position, e.body_radius);
                    0 != i && this.actDamage(t.act_role, e, s, i)
                })
        }
    }
    class Xe extends he {
        static getParaBill(e) {
            let t = e.role.getComponent(je);
            if (t) return t.buff_para_bill
        }
    }
    class Je extends he {
        static getParaBill(e) {
            return e.oPara
        }
        constructor() {
            super(), this.hit_rate = 1, this.atk_speed_rate = 1, this.crit_rate = .1, this.crit_atk_rate = 2
        }
    }
    class Ze extends Laya.Script3D {
        constructor() {
            super(), this.talent_list = new Array
        }
        onEnable() {
            this.role = this.owner
        }
        onDisable() {}
        onDestroy() {
            this.talent_list.splice(0, this.talent_list.length), this.getParaBill()
        }
        initValue() {
            this.role_script = this.role.getComponent(At)
        }
        pushTalent(e) {
            this.talent_list.push(e), this.getParaBill()
        }
        removeTalent(e) {
            let t = this.talent_list.indexOf(e);
            t > -1 && (this.talent_list.splice(t, 1), this.getParaBill())
        }
        getParaBill() {
            this.para_bill.reset(), this.talent_list.forEach(e => {
                this.para_bill.add(e.base_para)
            })
        }
    }
    class Qe extends he {
        static getParaBill(e) {
            let t = e.role.getComponent(Ze);
            if (t) return t.para_bill
        }
    }
    class $e extends he {
        static getReviseValue(e, t, i) {
            let s = ce.getReviseValue(e, t, i),
                a = Qe.getReviseValue(e, t, s);
            return Xe.getReviseValue(e, t, a)
        }
        static getReviseByOri(e, t, i = 0) {
            let s = Je.getReviseValue(e, t, i),
                a = ce.getReviseValue(e, t, s),
                n = Qe.getReviseValue(e, t, a);
            return Xe.getReviseValue(e, t, n)
        }
    }
    class et {
        constructor(e, t) {
            this.hit_rate = 1, this.crit_rate = .2, this.crit_atk_rate = 2, this.original = 0, this.base = 0, this.complete = 0, this.real = 0, this.is_hit = !0, this.is_crit = !1, this.type = 0, this.launch_role = e, this.skill = t
        }
        setValue(e, t = et.TYPE_NORMAL) {
            let i = this.launch_role.getComponent(At);
            this.original = e;
            let s = null;
            s = this.type == et.TYPE_NORMAL ? ce.RV_ATK : ce.RV_ATK_SKILL, this.getReviseValue(i, s, this.original), this.hit_rate = $e.getReviseByOri(i, $e.RV_HIT_RATE), this.crit_rate = $e.getReviseByOri(i, $e.RV_CRIT_RATE), this.crit_atk_rate = $e.getReviseByOri(i, $e.RV_CRIT_ATK_RATE), this.real = this.complete * this.critCheck(), null != t && (this.type = t)
        }
        getReviseValue(e, t, i) {
            let s = ce.getReviseValue(e, t, i);
            this.base = Qe.getReviseValue(e, t, s), this.complete = Xe.getReviseValue(e, t, this.base)
        }
        updateCompleteByAOERate(e) {
            this.complete = this.complete * e, this.real = this.real * e
        }
        computeReal(e, t = !1) {
            if (t) this.real = this.complete;
            else {
                let t = e.getComponent(At);
                if (this.hitCheck(t), !this.is_hit) return;
                if (this.type == et.TYPE_REVIVE) this.real = this.complete;
                else if (this.type == et.TYPE_CURE) this.real = this.complete * this.critCheck();
                else {
                    let e = $e.getReviseByOri(t, $e.RV_RDA, this.complete);
                    this.real = e * this.critCheck()
                }
            }
        }
        hitCheck(e) {
            let t = $e.getReviseByOri(e, $e.RV_MISS_RATE),
                i = this.hit_rate - t;
            return i = Math.max(0, i), i = Math.min(1, i), Math.random() < i ? (this.is_hit = !0, 1) : (this.is_hit = !1, 0)
        }
        critCheck() {
            return Math.random() < this.crit_rate ? (this.is_crit = !0, this.crit_atk_rate) : (this.is_crit = !1, 1)
        }
    }
    et.TYPE_NORMAL = 0, et.TYPE_SKILL = 1, et.TYPE_CURE = 2, et.TYPE_REVIVE = 3;
    class tt {
        static createFilter(e, t = 1, i = 1) {
            var s = tt.ColorFilterMat(e, t, i);
            return [new Laya.ColorFilter(s)]
        }
        static ColorHexToRgba(e) {
            return {
                r: parseInt("0x" + e.slice(1, 3)),
                g: parseInt("0x" + e.slice(3, 5)),
                b: parseInt("0x" + e.slice(5, 7))
            }
        }
        static ColorFilterMat(e, t = 1, i = 1) {
            var s = tt.ColorHexToRgba(e);
            return [s.r / 255, 0, 0, 0, i, 0, s.g / 255, 0, 0, i, 0, 0, s.b / 255, 0, i, 0, 0, 0, t, 0]
        }
        static createFilterByHSV(e, t = 1) {
            var i = tt.ColorFilterMatByVec4(this.hsvToRgb(e), t);
            return [new Laya.ColorFilter(i)]
        }
        static ColorFilterMatByVec4(e, t = 1) {
            return [e.x / 255, 0, 0, 0, t, 0, e.y / 255, 0, 0, t, 0, 0, e.z / 255, 0, t, 0, 0, 0, e.w / 255, 0]
        }
        static ColorToAlbedo(e, t = 1) {
            var i = tt.ColorHexToRgba(e);
            return new Laya.Vector4(i.r / 255, i.g / 255, i.b / 255, t)
        }
        static setColorByRate(e, t, i, s) {
            var a = e.meshRenderer.material;
            a || (a = new Laya.BlinnPhongMaterial, e.meshRenderer.material = a, a.albedoIntensity = 1, a.specularColor = new Laya.Vector4(100 / 255, 100 / 255, 100 / 255, 1), a.shininess = .13);
            var n = tt.ColorToAlbedo(t, 1),
                r = tt.ColorToAlbedo(i, 1),
                o = new Laya.Vector4;
            Laya.Vector4.subtract(r, n, o), Laya.Vector4.scale(o, s, o), Laya.Vector4.add(n, o, o), a.albedoColor = o
        }
        static hsvToRgb(e) {
            var t = e.x,
                i = e.y,
                s = e.z;
            i /= 100, s /= 100;
            var a = 0,
                n = 0,
                r = 0,
                o = Math.round(t / 60 % 6),
                l = t / 60 - o,
                h = s * (1 - i),
                c = s * (1 - l * i),
                d = s * (1 - (1 - l) * i);
            switch (o) {
                case 0:
                    a = s, n = d, r = h;
                    break;
                case 1:
                    a = c, n = s, r = h;
                    break;
                case 2:
                    a = h, n = s, r = d;
                    break;
                case 3:
                    a = h, n = c, r = s;
                    break;
                case 4:
                    a = d, n = h, r = s;
                    break;
                case 5:
                    a = s, n = h, r = c
            }
            return a = Math.round(255 * a), n = Math.round(255 * n), r = Math.round(255 * r), new Laya.Vector4(a, n, r, e.w)
        }
    }
    class it {
        static clear() {
            this.fps_arr && this.fps_arr.slice(0, this.fps_arr.length - 1)
        }
        static pushFPS() {
            var e = 1e3 / Laya.timer.delta;
            Laya.timer.delta < 250 && (this.fps_arr || (this.fps_arr = new Array), this.fps_arr.length >= this.max_length && this.fps_arr.shift(), this.fps_arr.push(e)), it.getAvgFPS() < it.low_performance_limit_fps && (it.is_low_performance = !0)
        }
        static getAvgFPS() {
            if (!this.fps_arr) return 60;
            if (this.fps_arr.length < this.max_length) return 60;
            var e = 0;
            for (var t in this.fps_arr) e += this.fps_arr[t];
            return e /= this.fps_arr.length
        }
        static getDelta() {
            var e = 1e3 / this.getAvgFPS();
            return e > 50 ? 50 : e
        }
    }
    it.max_length = 10, it.low_performance_limit_fps = 35, it.is_low_performance = !1;
    class st {
        constructor() {
            this.face_ctrl_auto = !0, this.speed_cur = 0
        }
        init(e) {
            this.role = e, this.body = e.getComponent(Laya.CharacterController)
        }
        onUpdate() {
            this.role && this.role.destroyed
        }
        updateVSpeed(e = 0, t = !1, i = 0) {
            this.speed_cur = C.axisLerpByDmax(this.speed_cur, e, .2, .16);
            let s = this.speed_cur * it.getDelta() * .001;
            t && (s = e * it.getDelta() * .001);
            let a = C.degToRad(i),
                n = this.role.transform.position;
            n.z = n.z + s * Math.cos(a), n.y = n.y - s * Math.sin(a), this.role.transform.position = n
        }
        setX(e) {
            this.x = e
        }
        updatePos(e) {
            this.dx = e;
            let t = this.x - e / 640 * 6;
            if (Math.abs(t) < 2.5) {
                let e = this.role.transform.position;
                Math.abs(e.x - t) > .8 && console.log(), e.x = t, this.role.transform.position = e
            }
        }
        updateREZRunning() {
            let e = this.role.transform.rotationEuler;
            e.z = C.axisLerpByDmax(e.z, 0, .1, 50 * it.getDelta() * .001), this.role.transform.rotationEuler = e
        }
        updateREZBeamAuto() {
            let e = this.role.transform.position.x,
                t = -10 * (e = e > 1e-4 ? 1 : -1) * it.getDelta() * .001,
                i = this.role.transform.rotationEuler;
            i.z = i.z + t, this.role.transform.rotationEuler = i, this.role.transform.translate(new Laya.Vector3(2e-4 * -i.z, 0, 0), !1)
        }
        updateREZRailsAuto(e) {
            if (Math.abs(e) > .1) {
                Math.abs(e) > 1 && (e = e / Math.abs(e) * 1);
                let t = -50 * e * it.getDelta() * .001,
                    i = this.role.transform.rotationEuler;
                i.z = i.z + t, this.role.transform.rotationEuler = i
            } else {
                let e = 10 * it.getDelta() * .001,
                    t = this.role.transform.rotationEuler;
                t.z = C.angleLerpByDmax(t.z, 0, .05, e), this.role.transform.rotationEuler = t
            }
        }
        updateREZBeam(e) {
            let t = 30 * (e = e > 0 ? 1 : -1) * it.getDelta() * .001,
                i = this.role.transform.rotationEuler;
            i.z = i.z + t, this.role.transform.rotationEuler = i
        }
    }
    class at extends Laya.Script3D {
        constructor() {
            super()
        }
        onUpdate() {}
        onEnable() {
            this.sp3 = this.owner, this.board_L = this.sp3.getChildAt(0).getChildAt(1), this.board_L.transform.localRotationEulerX = -90;
            this.board_L.transform.localRotationEulerX;
            this.board_R = this.sp3.getChildAt(0).getChildAt(2), this.board_R.transform.localRotationEulerX = -90, this.LightBase_L = this.sp3.getChildByName("sky_light_01"), this.LightBase_L.transform.localRotationEulerY = 0, this.LightBase_R = this.sp3.getChildByName("sky_light_02"), this.LightBase_R.transform.localRotationEulerY = 0, this.LightModel_L = this.LightBase_L.getChildAt(0), this.LightModel_L.transform.localRotationEulerZ = 20, this.LightModel_R = this.LightBase_R.getChildAt(0), this.LightModel_R.transform.localRotationEulerZ = -20, this.LC_L = this.LightModel_L.getChildAt(0).getChildAt(0), this.LC_L.active = !1, this.LC_R = this.LightModel_R.getChildAt(0).getChildAt(0), this.LC_R.active = !1
        }
        onDisable() {
            Laya.Tween.clearAll(this.board_L.transform), Laya.Tween.clearAll(this.board_R.transform), Laya.Tween.clearAll(this.LightModel_L.transform), Laya.Tween.clearAll(this.LightModel_R.transform)
        }
        onTriggerEnter() {
            this.LC_L.active || (Laya.Tween.to(this.board_L.transform, {
                localRotationEulerX: 0
            }, 400), Laya.Tween.to(this.board_R.transform, {
                localRotationEulerX: 0
            }, 400), Laya.Tween.to(this.LightBase_L.transform, {
                localRotationEulerY: -40
            }, 400), Laya.Tween.to(this.LightBase_L.transform, {
                localRotationEulerY: 40
            }, 400), Laya.Tween.to(this.LightModel_L.transform, {
                localRotationEulerZ: -20
            }, 400), Laya.Tween.to(this.LightModel_R.transform, {
                localRotationEulerZ: 20
            }, 400), this.LC_L.active = !0, this.LC_R.active = !0)
        }
    }
    class nt extends Laya.Script3D {
        constructor() {
            super(), this.max = 20, this.mFS = new b(this)
        }
        onUpdate() {
            this.mFS.Update()
        }
        onEnable() {
            this.sp3 = this.owner, this.mFS.ChangeState(rt.instance)
        }
        getDuan(e) {
            return Laya.timer.currTimer - e
        }
        getNow() {
            return Laya.timer.currTimer
        }
    }
    class rt {
        constructor() {
            rt.instance = this
        }
        Enter(e) {}
        Execute(e) {
            e.max > 0 ? e.sp3.transform.localRotationEulerX < e.max ? e.sp3.transform.localRotationEulerX = e.sp3.transform.localRotationEulerX + .001 * it.getDelta() * .03 * 360 : e.mFS.ChangeState(ot.instance) : e.sp3.transform.localRotationEulerX > e.max ? e.sp3.transform.localRotationEulerX = e.sp3.transform.localRotationEulerX - .001 * it.getDelta() * .03 * 360 : e.mFS.ChangeState(ot.instance)
        }
        Exit(e) {}
    }
    new rt;
    class ot {
        constructor() {
            ot.instance = this
        }
        Enter(e) {
            e.max = -e.max, e.stime = e.getNow()
        }
        Execute(e) {
            e.getDuan(e.stime) > 1500 && e.mFS.ChangeState(rt.instance)
        }
        Exit(e) {}
    }
    new ot;
    class lt extends Laya.Script3D {
        constructor() {
            super(), this.rps = .0652
        }
        onUpdate() {
            this.sp3.transform.rotate(new Laya.Vector3(0, .001 * -it.getDelta() * this.rps * 360, 0), !1, !1)
        }
        onEnable() {
            this.sp3 = this.owner, this.sp3.transform.localRotationEulerY = 0
        }
        getDuan(e) {
            return Laya.timer.currTimer - e
        }
        getNow() {
            return Laya.timer.currTimer
        }
    }
    class ht extends Laya.Script3D {
        constructor() {
            super()
        }
        onUpdate() {
            this.sp3.transform.rotate(new Laya.Vector3(0, .001 * -it.getDelta() * .1 * 360, 0), !1, !1)
        }
        onEnable() {
            this.sp3 = this.owner, this.sp3.transform.localRotationEulerY = 0
        }
        getDuan(e) {
            return Laya.timer.currTimer - e
        }
        getNow() {
            return Laya.timer.currTimer
        }
    }
    class ct extends Laya.Script3D {
        constructor() {
            super(), this.rps = .15789, this.r_speed = 1
        }
        onUpdate() {
            this.sp3.transform.rotate(new Laya.Vector3(0, .001 * -it.getDelta() * this.rps * 360 * this.r_speed, 0), !0, !1)
        }
        onEnable() {
            this.sp3 = this.owner, this.box = this.sp3.getChildAt(1).getChildAt(0)
        }
        initValue(e) {
            e.indexOf("#FAST"), this.r_speed = 1, e.indexOf("#ANTI") > -1 && (this.r_speed = -this.r_speed), e.indexOf("#SHORT") > -1 ? this.box.transform.localScaleZ = 1.6 : this.box.transform.localScaleZ = 4.2
        }
        getDuan(e) {
            return Laya.timer.currTimer - e
        }
        getNow() {
            return Laya.timer.currTimer
        }
    }
    class dt extends Laya.Script3D {
        constructor() {
            super(), this.aniName = "", this.aniSpeed = 1, this.run_timer = 1e3, this.isrun = !1, this.pre_anim_normalized_time = 0, this.last_normalized = 0
        }
        onEnable() {
            this.role = this.owner, this.ani = this.role.getComponent(Laya.Animator), this.playIdle()
        }
        onUpdate() {}
        playIdle() {
            this.playAnim("sit")
        }
        playWin() {
            let e = _.getIntegerInRandom(2, 1);
            this.playAnim("win" + e)
        }
        playAnim(e, t = 0, i = 0) {
            this.ani && e != this.aniName && (this.aniName = e, 0 == t ? this.ani.play(this.aniName, 0, i) : this.ani.crossFade(this.aniName, t, 0, i))
        }
        getAnimStartNormalizedTime() {
            var e = this.ani.getCurrentAnimatorPlayState().normalizedTime;
            return this.last_normalized, this.last_normalized = e, e - this.pre_anim_normalized_time >= 0 ? e - this.pre_anim_normalized_time : (this.pre_anim_normalized_time = e + 1, e)
        }
    }
    class _t {
        static mapinit(e, t) {
            let i = e.getChildByName(t),
                s = this.setBirth(i),
                a = this.setObstacles(i.getChildByName("Obstacles"));
            this.setSegments(i.getChildByName("Segments"));
            let n = bt.hasFashionWeek(i);
            n > -1 && this.setMeshShadowOff(i.getChildAt(n));
            let r = bt.hasChallengeLevel(i);
            return r > -1 && (this.setMeshShadowOff(i.getChildAt(r)), this.setCheckpoints(i.getChildByName("Checkpoints"))), {
                hp_player_birth: s,
                obstacle_list: a
            }
        }
        static setBirth(e) {
            let t = new Laya.Sprite3D;
            return e.addChild(t), t.transform.localPosition = new Laya.Vector3(0, 0, 0), t.transform.translate(new Laya.Vector3(0, 0, -.3), !1), t
        }
        static setSegments(e) {
            for (let t = 0; t < e.numChildren; t++) {
                let i = e.getChildAt(t);
                if (i.name.indexOf("Cube.021") > -1 || i.name.indexOf("Cube.066") > -1) i.transform.localScaleZ = 1.0005;
                else if (i.name.indexOf("GroundMovingCircle") > -1) {
                    i.getChildAt(0).getComponent(lt) || i.getChildAt(0).addComponent(lt)
                }
                this.setSegment(i), i.numChildren > 0 && this.setSegments(i)
            }
            this.setMeshReceiveShadow(e)
        }
        static setSegment(e) {
            let t = e.getComponent(Laya.PhysicsCollider);
            t && (t.collisionGroup = q.road_category, t.canCollideWith = q.road_mask, t.isTrigger = !1)
        }
        static setObstacles(e) {
            let t = new Array;
            for (let i = 0; i < e.numChildren; i++) {
                let s = e.getChildAt(i);
                if (s.name.indexOf("RotatingObstacle") > -1) this.setRotatingObstacle(s, t);
                else if (s.name.indexOf("GrindPad") > -1) this.setGrindPad(s, t);
                else if (s.name.indexOf("Obstacle") > -1) this.setObstacle(s, t);
                else if (s.name.indexOf("Set") > -1 || s.name.indexOf("set") > -1 || s.name.indexOf("obstacles") > -1)
                    for (let e = 0; e < s.numChildren; e++) {
                        let i = s.getChildAt(e);
                        i.name.indexOf("RotatingObstacle") > -1 ? this.setRotatingObstacle(i, t) : i.name.indexOf("GrindPad") > -1 ? this.setGrindPad(i, t) : i.name.indexOf("Obstacle") > -1 && this.setObstacle(i, t)
                    }
            }
            return t
        }
        static setObstacle(e, t) {
            if (e.transform.position.z < 1) return;
            let i = K.getSP(4001);
            v.addChild(e, i);
            let s = i.getComponent(Laya.PhysicsCollider);
            s && (s.collisionGroup = q.obstacle_category, s.canCollideWith = q.obstacle_mask, s.isTrigger = !0, t.push(i))
        }
        static setGrindPad(e, t) {
            if (e.transform.position.z < 1) return;
            let i = K.getSP(4004);
            v.addChild(e, i);
            let s = i.getComponent(Laya.PhysicsCollider);
            s && (s.collisionGroup = q.obstacle_category, s.canCollideWith = q.obstacle_mask, s.isTrigger = !0, t.push(i))
        }
        static setRotatingObstacle(e, t) {
            if (e.transform.position.z < 1) return;
            let i = K.getSP(4005);
            e.addChild(i), i.transform.position = e.transform.position.clone(), i.transform.rotation = e.transform.rotation.clone(), i.transform.setWorldLossyScale(new Laya.Vector3(100, 100, 100));
            let s = i.getChildAt(1).getChildAt(0);
            s.name = "RotatingObstacle";
            let a = s.getComponent(Laya.PhysicsCollider);
            a && (a.collisionGroup = q.obstacle_category, a.canCollideWith = q.obstacle_mask, a.isTrigger = !0, t.push(i));
            let n = i.getComponent(ct);
            n || (n = i.addComponent(ct)), n.initValue(e.name)
        }
        static refreshCollectables(e, t, i, s = -1, a) {
            let n = e.getChildByName("Collectables");
            this.refreshCollectablesCore(n, t, i, s, a);
            let r = e.getChildByName("Obstacles");
            for (let e = 0; e < r.numChildren; e++) {
                let n = r.getChildAt(e);
                (n.name.indexOf("Set") > -1 || n.name.indexOf("set") > -1 || n.name.indexOf("obstacles") > -1) && this.refreshCollectablesCore(n, t, i, s, a)
            }
            let o = e.getChildByName("Segments");
            for (let e = 0; e < o.numChildren; e++) {
                let n = o.getChildAt(e);
                if (n.name.indexOf("GroundMovingCircle") > -1) {
                    for (let e = 0; e < n.getChildAt(0).numChildren; e++) {
                        let r = n.getChildAt(0).getChildAt(e);
                        this.refreshCollectablesCore(r, t, i, s, a), this.setObstacles(r)
                    }
                    n.getChildAt(0).numChildren > 0 && n.getChildAt(0).getChildAt(0).name.indexOf("MovingGem") > -1 && this.refreshCollectablesCore(n.getChildAt(0), t, i, s, a)
                }
            }
        }
        static refreshCollectablesCore(e, t, i, s = -1, a) {
            for (let n = 0; n < e.numChildren; n++) {
                let r = e.getChildAt(n);
                if (r.transform.position.z < i - 5) continue;
                let o = null;
                if (r.name.indexOf("Gem") > -1 ? (0 == r.numChildren && (o = K.getSP(4002)), o && (o.getComponent(ht) || o.addComponent(ht))) : r.name.indexOf("HeelPart") > -1 ? (r.numChildren > 0 && K.recoveryComplexSP(r), 4 != (o = bt.getHeelPart(t)).numChildren && console.log()) : r.name.indexOf("InGameRewardCollectable") > -1 && s >= bt.Reward_Shoes && (r.numChildren > 0 && K.recoveryComplexSP(r.getChildAt(0)), S.showTryShoes() && (o = bt.getInGameRewardCollectable(s, a)), o && (o.getComponent(ht) || o.addComponent(ht), s == bt.Reward_Shoes && o.transform.setWorldLossyScale(new Laya.Vector3(100, 100, 100)))), o) {
                    v.addChild(r, o);
                    let e = o.getComponent(Laya.PhysicsCollider);
                    e && (e.collisionGroup = q.prop_category, e.canCollideWith = q.prop_mask, e.isTrigger = !0), _t.setMeshRecastShadow(o)
                }
            }
        }
        static setFinish(e) {
            let t = Laya.loader.getRes(H.instance.getCompleteResByID(20002));
            e.scene.addChild(t);
            let i = e.getChildByName("Segments").getChildByName("Finish");
            t.transform.position = i.transform.position.clone(), t.transform.translate(new Laya.Vector3(0, -.01, -.5), !1);
            let s = t.getChildByName("hp_Audience");
            for (let e = 0; e < s.numChildren; e++) {
                let t = s.getChildAt(e),
                    i = _.getIntegerInRandom(10, 7),
                    a = K.getSP(2e3 + i);
                t.addChild(a), a.transform.localPosition = new Laya.Vector3(0, 0, 0), a.transform.localRotationEuler = new Laya.Vector3(0, 0, 0), a.addComponent(dt), Jt.instance.win_role.push(a)
            }
            let a = new Array;
            for (let e = 0; e < t.numChildren; e++) {
                let i = t.getChildAt(e),
                    s = i.getComponent(Laya.PhysicsCollider);
                s && (s.collisionGroup = q.road_category, s.canCollideWith = q.road_mask, "BaseStep" == i.name || "Podium" == i.name ? s.isTrigger = !1 : s.isTrigger = !0), "hp_effect_win" == i.name && a.push(i.transform.position.clone())
            }
            let n = t.getChildByName("finish_background");
            n && 4 == e.numChildren ? n.active = !0 : n.active = !1;
            let r = t.getChildByName("light");
            for (let e = 0; e < r.numChildren; e++) {
                let t = r.getChildAt(e);
                t.getComponent(nt) || t.addComponent(nt)
            }
            return this.setMeshReceiveShadow(t.getChildByName("finish")), a
        }
        static setCheckpoints(e) {
            for (let t = 0; t < e.numChildren; t++) {
                let i = e.getChildAt(t),
                    s = K.getSP(20003);
                v.addChild(i, s);
                let a = s.getComponent(Laya.PhysicsCollider);
                a && (a.collisionGroup = q.prop_category, a.canCollideWith = q.prop_mask, a.isTrigger = !0), s.getComponent(at) || s.addComponent(at)
            }
        }
        static setMeshRecastShadow(e) {
            e instanceof Laya.MeshSprite3D ? (e.meshRenderer.castShadow = !0, e.meshRenderer.receiveShadow = !1) : e instanceof Laya.SkinnedMeshSprite3D && (e.skinnedMeshRenderer.castShadow = !0, e.skinnedMeshRenderer.receiveShadow = !1);
            for (let t = 0; t < e.numChildren; t++) this.setMeshRecastShadow(e.getChildAt(t))
        }
        static setMeshReceiveShadow(e) {
            e instanceof Laya.MeshSprite3D && (e.name.indexOf("line") > -1 ? e.meshRenderer.castShadow = !0 : e.meshRenderer.castShadow = !1, e.meshRenderer.receiveShadow = !0);
            for (let t = 0; t < e.numChildren; t++) this.setMeshReceiveShadow(e.getChildAt(t))
        }
        static setMeshShadowOff(e) {
            e instanceof Laya.MeshSprite3D && (e.meshRenderer.castShadow = !1, e.meshRenderer.receiveShadow = !1);
            for (let t = 0; t < e.numChildren; t++) this.setMeshShadowOff(e.getChildAt(t))
        }
        static find(e, t, i = !0) {
            let s = new Array;
            return this.findCore(s, e, t, i), s
        }
        static findCore(e, t, i, s = !0) {
            for (let a = 0; a < t.numChildren; a++) {
                let n = t.getChildAt(a);
                s ? n.name == i && e.push(n) : n.name.indexOf(i) > -1 && e.push(n), this.findCore(e, n, i, s)
            }
        }
    }
    class mt extends Laya.Script3D {
        constructor() {
            super()
        }
        onUpdate() {
            this.sp3.transform.rotate(new Laya.Vector3(0, .001 * -it.getDelta() * .1 * 360, 0), !1, !1)
        }
        onEnable() {
            this.sp3 = this.owner, this.sp3.transform.localRotationEulerY = 0
        }
        getDuan(e) {
            return Laya.timer.currTimer - e
        }
        getNow() {
            return Laya.timer.currTimer
        }
    }
    class ut {
        constructor() {
            ut.instance = this
        }
        Enter(e) {
            console.log("StateStoreCameraIdle"), e.camera.useOcclusionCulling = !0, e.camera.fieldOfView = 38
        }
        Execute(e) {}
        Exit(e) {}
    }
    new ut;
    class gt {
        constructor() {
            gt.instance = this
        }
        Enter(e) {
            console.log("StateStoreCameraBody"), e.setRunningStartParam()
        }
        Execute(e) {
            e.transformToRunning()
        }
        Exit(e) {}
    }
    new gt;
    class pt {
        constructor() {
            pt.instance = this
        }
        Enter(e) {
            console.log("StateStoreCameraNeck"), e.setRunningStartParam()
        }
        Execute(e) {
            e.transformToRunning()
        }
        Exit(e) {}
    }
    new pt;
    class ft {
        constructor() {
            ft.instance = this
        }
        Enter(e) {
            console.log("StateStoreCameraShoes"), e.setRunningStartParam()
        }
        Execute(e) {
            e.transformToRunning()
        }
        Exit(e) {}
    }
    new ft;
    class yt extends Laya.Script {
        constructor() {
            super(), this.run_v = new Laya.Vector3, this.mStateMachine = new b(this)
        }
        onEnable() {
            this.camera = this.owner, this.mStateMachine.ChangeState(ut.instance)
        }
        onDisable() {}
        onUpdate() {
            this.mStateMachine.Update()
        }
        getFSM() {
            return this.mStateMachine
        }
        goHpBody(e) {
            this.goState(e, gt.instance)
        }
        goHpNeck(e) {
            this.goState(e, pt.instance)
        }
        goHpShoes(e) {
            this.goState(e, ft.instance)
        }
        goState(e, t) {
            this.hp = e, this.getFSM().isInState(t) || this.getFSM().ChangeState(t)
        }
        setRunningStartParam() {
            this.target_pos = this.hp.transform.position.clone(), this.start_pos = this.camera.transform.position.clone(), Laya.Vector3.subtract(this.target_pos, this.start_pos, this.run_v), C.Vec3Abs(this.run_v), Laya.Vector3.scale(this.run_v, 1 / .3, this.run_v)
        }
        transformToRunning() {
            let e = new Laya.Vector3;
            Laya.Vector3.scale(this.run_v, .001 * it.getDelta(), e);
            let t = new Laya.Vector3;
            C.Vec3LerpByDmax(this.camera.transform.position, this.target_pos, new Laya.Vector3(.1, .1, .1), e, t), this.camera.transform.position = t
        }
    }
    class St {
        static createByUnity(e, t, i) {
            H.loadSubPack;
            let s = K.getSP(this.RID_ROLE),
                a = K.getSP(t);
            s.getChildByName("hp_base").addChild(a), v.addChild(s.getChildByName("hp_base"), a), e.addChild(s), s.transform.position = i;
            let n = s.getComponent(Laya.CharacterController);
            if (!n) {
                let e = s.getComponent(Laya.PhysicsCollider);
                (n = s.addComponent(Laya.CharacterController)).colliderShape = e.colliderShape.clone(), e.enabled = !1
            }
            return n.collisionGroup = q.role_cap_category, n.canCollideWith = q.role_cap_mask, s
        }
    }
    St.RID_ROLE = 1e3;
    class bt {
        static init() {
            this.drama_list = new Array;
            for (var e = Laya.loader.getRes(H.JSON_PATH + V.JSON_RES_NAME)[V.JSON_KEY], t = 0; t < e.length; t++) {
                var i = V.creatByJson(e[t]);
                this.drama_list.push(i)
            }
        }
        static preLoadPropRes(e) {
            K.addSPList(new Y(1e3), 1, 2);
            let t = d.getItemByID(f.getPlayerSkin());
            K.addSPList(new Y(t.ml), 1, 2), K.addSPList(new Y(2001), 20, 100), K.addSPList(new Y(2002), 20, 100), K.addSPList(new Y(2003), 20, 200), K.addSPList(new Y(2004), 1, 1), K.addSPList(new Y(2005), 1, 1), K.addSPList(new Y(2006), 1, 1), K.addSPList(new Y(2007), 10, 20), K.addSPList(new Y(2008), 10, 20), K.addSPList(new Y(2009), 10, 20), K.addSPList(new Y(2010), 10, 20);
            for (let e = 0; e < this.jewelry_count; e++) K.addSPList(new Y(3001, e), 1, 1);
            K.addSPList(new Y(4001), 50, 300), K.addSPList(new Y(4002), 30, 300), K.addSPList(new Y(4003), 1, 1), K.addSPList(new Y(4004), 30, 500), K.addSPList(new Y(4005), 3, 100), 1001 != t.ml && K.addSPList(new Y(1001), 2, 2), K.addSPList(new Y(5001), 2, 2), K.addSPList(new Y(20003), 4, 10), K.preLoad(this, () => {
                let t = [],
                    i = H.instance.getCompleteResByID(6001),
                    s = H.instance.getCompleteResByID(6002);
                t.push(i), t.push(s), Laya.loader.create(t, Laya.Handler.create(this, () => {
                    e.run()
                }))
            })
        }
        static loadLevelScene(e, t, i, s, a) {
            let n = new Array;
            n.push(H.instance.getCompleteResByID(this.environment_id)), n.push(H.instance.getCompleteResByID(this.Finish_id)), n.push(H.instance.getCompleteResByID(e)), Laya.loader.create(n, Laya.Handler.create(this, () => {
                var n = new Laya.Scene3D;
                Laya.stage.addChild(n), n.zOrder = -1;
                var r = Laya.loader.getRes(H.instance.getCompleteResByID(e));
                n.addChild(r), r.transform.position = new Laya.Vector3(0, 0, 0);
                let o = 1e3,
                    l = 200;
                32001 == e ? (o = 200, l = 180) : 32006 == e ? (o = 80, l = 60) : 32007 == e && (o = 200, l = 150);
                var h = n.addChild(new Laya.Camera(0, .1, o));
                h.addComponent(Ct);
                var c = n.addChild(new Laya.DirectionLight);
                c.color = new Laya.Vector3(1, 1, 1), c.intensity = 1, c.transform.rotation = new Laya.Quaternion(-.01314224, .8809368, .4326456, .1912992), c.shadowMode = Laya.ShadowMode.SoftLow, c.shadowDistance = 30, c.shadowResolution = 2048, c.shadowCascadesMode = Laya.ShadowCascadesMode.NoCascades;
                let d = this.hasFashionWeek(r),
                    _ = bt.hasChallengeLevel(r);
                d > -1 ? this.setSpecialFog(n, r, h, d, 3) : _ > -1 ? this.setSpecialFog(n, r, h, _, 1) : (h.clearFlag = Laya.CameraClearFlags.SolidColor, n.fogColor = new Laya.Vector3(99 / 255, 242 / 255, 243 / 255)), n.ambientColor = new Laya.Vector3(.5, .5, .5), n.enableFog = !0, n.fogStart = 30, n.fogRange = l, a && (a.args = [n, r, h]), bt.loadShoesRes(a, t, i, s)
            }))
        }
        static setSpecialFog(e, t, i, s, a) {
            let n = t.getChildAt(s).getChildAt(a),
                r = tt.ColorHexToRgba("#" + n.name.split("_")[1]);
            e.fogColor = new Laya.Vector3(r.r / 255, r.g / 255, r.b / 255);
            let o = n.meshRenderer.sharedMaterial.albedoTexture;
            if (!e.skyRenderer.material) {
                let t = new Laya.SkyPanoramicMaterial;
                t.panoramicTexture = o, e.skyRenderer.material = t, i.clearFlag = Laya.CameraClearFlags.Sky
            }
        }
        static hasFashionWeek(e) {
            for (let t = 0; t < e.numChildren; t++)
                if (e.getChildAt(t).name.indexOf("FashionWeek") > -1) return t;
            return -1
        }
        static hasChallengeLevel(e) {
            for (let t = 0; t < e.numChildren; t++)
                if (e.getChildAt(t).name.indexOf("_Challenge_") > -1) return t;
            return -1
        }
        static loadShoesRes(e, t, i = -1, s) {
            this.addShoesToMemPreLoad(t), i == this.Reward_Shoes && this.addShoesToMemPreLoad(s), K.preLoad(this, () => {
                e.run()
            })
        }
        static addShoesToMemPreLoad(e) {
            let t = this.getShoesOrderLeft(e);
            if (!K.getSP(2004, t)) {
                let i = this.getShoesOrderRight(e),
                    s = this.getShoesOrderHeel(e);
                K.addSPList(new Y(2004, t), 20, 100), K.addSPList(new Y(2005, i), 20, 100), K.addSPList(new Y(2006, s), 40, 200)
            }
        }
        static getShoesOrderLeft(e) {
            return K.getChildID(2004, e + "_left")
        }
        static getShoesOrderRight(e) {
            return K.getChildID(2005, e + "_right")
        }
        static getShoesOrderHeel(e) {
            return K.getChildID(2006, e + "_Heel")
        }
        static getHeelPart(e) {
            let t = this.getShoesOrderLeft(e),
                i = this.getShoesOrderRight(e),
                s = this.getShoesOrderHeel(e),
                a = K.getSP(2003);
            a.transform.setWorldLossyScale(new Laya.Vector3(100, 100, 100)), a.numChildren > 2 && K.recoveryComplexSP(a);
            let n = K.getSP(2006, s),
                r = K.getSP(2006, s);
            a.addChild(n), v.cloneLocalTransform(a.getChildByName("hp_left").transform, n.transform), a.addChild(r), v.cloneLocalTransform(a.getChildByName("hp_right").transform, r.transform);
            let o = K.getSP(2004, t),
                l = K.getSP(2005, i);
            return n.addChild(o), v.resetLocalTransform(o.transform), r.addChild(l), v.resetLocalTransform(l.transform), a
        }
        static getInGameRewardCollectable(e, t) {
            let i = K.getSP(4003);
            if (e == this.Reward_Shoes) {
                let e = this.getShoesOrderLeft(t),
                    s = this.getShoesOrderRight(t),
                    a = i.getChildByName("ShoeScaleParent"),
                    n = a.getChildByName("hp_left"),
                    r = a.getChildByName("hp_right"),
                    o = K.getSP(2004, e),
                    l = K.getSP(2005, s);
                return a.addChild(o), v.cloneLocalTransform(n.transform, o.transform), a.addChild(l), v.cloneLocalTransform(r.transform, l.transform), i
            } {
                let e = i.getChildByName(t);
                if (e) {
                    if ("wonderw_armbelt" == t) {
                        let t = K.getSPBySonName(3001, "wonderw_armbelt_l"),
                            i = K.getSPBySonName(3001, "wonderw_armbelt_r");
                        e.getChildByName("hp_left").addChild(t), v.resetLocalTransform(t.transform), e.getChildByName("hp_right").addChild(i), v.resetLocalTransform(i.transform)
                    } else {
                        let i = K.getSPBySonName(3001, t);
                        e.addChild(i), v.resetLocalTransform(i.transform)
                    }
                    return i
                }
            }
            return null
        }
        static getHeelNew(e, t) {
            let i = K.getSP(t ? 2001 : 2002),
                s = i.getChildByName("hp_heel"),
                a = this.getShoesOrderHeel(e),
                n = K.getSP(2006, a);
            return v.addChild(s, n), n.transform.localScale = new Laya.Vector3(1, 1, 1), i
        }
        static changeHeelNewMode(e, t) {
            let i = e.getChildByName("hp_heel");
            K.recoveryComplexSP(i);
            let s = this.getShoesOrderHeel(t),
                a = K.getSP(2006, s);
            v.addChild(i, a), a.transform.localScale = new Laya.Vector3(1, 1, 1)
        }
        static getDrama(e) {
            return e = e > this.drama_list.length - 1 ? this.drama_list.length - 1 : e, this.drama_list[e]
        }
        static loadStoreScene3D(e) {
            let t = new Laya.Scene3D;
            t.ambientColor = new Laya.Vector3(175 / 255, 175 / 255, 175 / 255);
            let i = K.getSP(5001),
                s = i.getChildByName("Directional Light"),
                a = i.getChildByName("hp_role_re"),
                n = a.getChildAt(0),
                r = i.getChildByName("store_stage"),
                o = i.getChildByName("hp_camera_body"),
                l = (i.getChildByName("hp_camera_neck"), i.getChildByName("hp_camera_shoes")),
                h = i.numChildren;
            for (let e = 0; e < h; e++) t.addChild(i.getChildAt(0));
            _t.setMeshReceiveShadow(r), a.addComponent(mt), n.transform.translate(new Laya.Vector3(0, -.015, 0));
            let c = new Laya.DirectionLight;
            t.addChild(c), c.transform.rotationEuler = s.transform.rotationEuler.clone(), c.color = s.color.clone(), c.intensity = s.intensity, s.destroy(), c.shadowMode = Laya.ShadowMode.SoftHigh, c.shadowDistance = 10, c.shadowResolution = 2048, c.shadowCascadesMode = Laya.ShadowCascadesMode.NoCascades, o.transform.translate(new Laya.Vector3(0, -.25, 0)), l.transform.translate(new Laya.Vector3(0, -.15, 0));
            let d = new Laya.Camera(0, .1, 100);
            d.name = "camera", d.clearColor = new Laya.Vector4(110 / 255, 155 / 255, 1, 1), d.normalizedViewport = new Laya.Viewport(0, 0, 1, e);
            d.addComponent(yt);
            t.addChild(d), d.transform.position = o.transform.position.clone();
            let _ = o.transform.rotationEuler.clone();
            return _.x = 7, _.y = _.y - 180, d.transform.rotationEuler = _, t
        }
        static loadShoesTryScene3D(e) {
            let t = new Laya.Scene3D;
            t.ambientColor = new Laya.Vector3(175 / 255, 175 / 255, 175 / 255), t.enableFog = !0, t.fogColor = new Laya.Vector3(110 / 255, 155 / 255, 1), t.fogStart = 10, t.fogRange = 50;
            let i = K.getSP(5001),
                s = i.getChildByName("Directional Light"),
                a = i.getChildByName("hp_role_re"),
                n = a.getChildAt(0),
                r = i.getChildByName("store_stage"),
                o = i.getChildByName("hp_camera_shoes"),
                l = i.numChildren;
            for (let e = 0; e < l; e++) t.addChild(i.getChildAt(0));
            r.meshRenderer.sharedMaterial.albedoIntensity = .85;
            let h = Laya.loader.getRes(H.instance.getCompleteResByID(20002)),
                c = Laya.Sprite3D.instantiate(h);
            t.addChild(c), c.transform.position = new Laya.Vector3(0, -4, -52), c.transform.rotationEuler = new Laya.Vector3(0, 0, 0);
            let d = c.getChildByName("light").getChildAt(1).transform.position.clone(),
                _ = new Laya.Sprite3D;
            t.addChild(_), _.transform.position = d, _.addChild(c), c.transform.position = new Laya.Vector3(0, -4, -52), _.transform.translate(new Laya.Vector3(0, -1.5, 0)), _.transform.rotationEuler = new Laya.Vector3(-3, 0, 0);
            for (let e = 0; e < c.numChildren; e++) {
                let e = c.getChildAt(0);
                e.getComponent(Laya.PhysicsCollider) && (e.getComponent(Laya.PhysicsCollider).enabled = !1)
            }
            n.transform.translate(new Laya.Vector3(0, -.015, 0));
            let m = new Laya.DirectionLight;
            t.addChild(m), m.transform.rotationEuler = s.transform.rotationEuler.clone(), m.color = s.color.clone(), m.intensity = .9 * s.intensity, s.destroy(), a.addComponent(mt), o.transform.translate(new Laya.Vector3(0, -.4, -1.65));
            let u = new Laya.Camera(0, .1, 100);
            u.name = "camera", u.clearColor = new Laya.Vector4(110 / 255, 155 / 255, 1, 1), u.fieldOfView = 38, u.normalizedViewport = new Laya.Viewport(0, 0, 1, e), t.addChild(u), u.transform.position = o.transform.position.clone();
            let g = o.transform.rotationEuler.clone();
            g.x = 0, g.y = g.y - 180, u.transform.rotationEuler = g, n.transform.localRotationEulerZ = -2;
            let p = St.createByUnity(t, 1001, n.transform.position);
            n.addChild(p), p.transform.localPosition = new Laya.Vector3(0, 0, 0);
            p.addComponent(Lt);
            return p.getComponent(Laya.CharacterController).enabled = !1, t
        }
    }
    bt.environment_id = 20001, bt.Finish_id = 20002, bt.jewelry_count = 26, bt.Reward_Shoes = 0, bt.Reward_Jewelry = 1;
    class Et {
        static layaVector3D(e) {
            return new Laya.Vector3(-e.x, e.y, e.z)
        }
        static layaQuat(e) {
            return new Laya.Quaternion(e.x, -e.y, -e.z, e.w)
        }
        static QuaternionLookRotation(e, t) {
            Laya.Vector3.normalize(e, e);
            var i = e.clone(),
                s = new Laya.Vector3;
            Laya.Vector3.cross(t, i, s), Laya.Vector3.normalize(s, s);
            var a = new Laya.Vector3;
            Laya.Vector3.cross(i, s, a);
            var n = s.x,
                r = s.y,
                o = s.z,
                l = a.x,
                h = a.y,
                c = a.z,
                d = i.x,
                _ = i.y,
                m = i.z,
                u = n + h + m,
                g = new Laya.Quaternion;
            if (u > 0) {
                var p = Math.sqrt(u + 1);
                return g.w = .5 * p, p = .5 / p, g.x = (c - _) * p, g.y = -(d - o) * p, g.z = -(r - l) * p, g
            }
            if (n >= h && n >= m) {
                var f = Math.sqrt(1 + n - h - m),
                    y = .5 / f;
                return g.x = .5 * f, g.y = -(r + l) * y, g.z = -(o + d) * y, g.w = (c - _) * y, g
            }
            if (h > m) {
                var S = Math.sqrt(1 + h - n - m),
                    b = .5 / S;
                return g.x = (l + r) * b, g.y = -.5 * S, g.z = -(_ + c) * b, g.w = (d - o) * b, g
            }
            var E = Math.sqrt(1 + m - n - h),
                A = .5 / E;
            return g.x = (d + o) * A, g.y = -(_ + c) * A, g.z = -.5 * E, g.w = (r - l) * A, g
        }
    }
    class At extends Laya.Script3D {
        constructor() {
            super(), this.wear_shoes_name = "", this.wear_jewelry_name = "", this.heel_num = 0, this.hp_cur = 1, this.WALK_SPEED = 6, this.RAILS_SPEED = 8.7, this.BEAM_SPEED = 3.2, this.SUPER_WIN_WALK_SPEED = 1.18, this.SUPER_WIN_WALK_DUAN = 6500, this.WALK_ANIM_DUAN = .567, this.rails_speed_cur = 8.2, this.atk_range_max = 1.5, this.atk_range_min = 0, this.atk_ready_duan = 0, this.atk_cd = 300, this.atk_anim_duan = 300, this.dead_cd = 3e3, this.ro_speed = 90, this.bullet_rid = 0, this.atk_ready_stime = 0, this.atk_stime = 0, this.clip_stime = 0, this.dead_stime = 0, this.is_can_revive = !1, this.body_radius = 0, this.walk_line_beam_rex = 0, this.walk_line_rail_rex = 0, this.col_dead_ground_pos_y = -99999, this.last_add_heel_time = 0, this.mFSMLeg = new b(this), this.mFSMLeg.ChangeState(J.instance), this.move_ctrl = new st, this.oPara = new Je
        }
        onUpdate() {
            this.updateFoots(), this.mFSMLeg.Update(), this.move_ctrl.onUpdate()
        }
        onEnable() {
            this.role = this.owner, this.role_sp = this.role.getChildByName("hp_base"), this.setAvatar(), this.body = this.role.getComponent(Laya.CharacterController), this.move_ctrl.init(this.role)
        }
        setAvatar() {
            this.destroyHpFoots(), this.avatar_3p = this.role_sp.getChildAt(0), this.hp_3p_anim = this.avatar_3p.getComponent(Laya.Animator), this.hp_foot_left = this.addSceneFoot("foot.L"), this.hp_foot_left_re_def = new Laya.Vector3(68.1881, 169.9592, 152.92783), this.hp_foot_right = this.addSceneFoot("foot.R"), this.hp_foot_right_re_def = new Laya.Vector3(68.1881, -168.6648, -152.92783), this.col_dead_ground_pos_y = -9999, this.mFSMLeg.ChangeState(Z.instance), _t.setMeshRecastShadow(this.avatar_3p)
        }
        onDisable() {}
        destroyHpFoots() {
            this.hp_foot_left && (K.recoveryComplexSP(this.hp_foot_left), this.hp_foot_left.destroy(), this.hp_foot_left = null), this.hp_foot_right && (K.recoveryComplexSP(this.hp_foot_right), this.hp_foot_right.destroy(), this.hp_foot_right = null)
        }
        reset(e, t) {
            this.Segments = t, this.move_ctrl.updateVSpeed(0, !0), this.role.transform.position = e.clone();
            let i = this.role.transform.rotationEuler;
            i.z = 0, this.role.transform.rotationEuler = i, this.role_sp.transform.localPositionY = .47;
            let s = this.body.colliderShape,
                a = new Laya.CapsuleColliderShape(.3, 1.9, 1);
            a.localOffset.y = .95, s.destroy(), this.body.colliderShape = a, this.heel_num = 0, this.mFSMLeg.ChangeState(Z.instance)
        }
        ctrlMoveX(e) {
            this.mFSMLeg.isInState(Q.instance) ? this.move_ctrl.updatePos(e) : this.mFSMLeg.isInState($.instance) ? this.move_ctrl.updateREZBeam(e) : (this.mFSMLeg.isInState(ee.instance) || this.mFSMLeg.isInState(te.instance)) && this.move_ctrl.updatePos(e)
        }
        addSceneFoot(e) {
            let t = this.findChild(this.avatar_3p, e),
                i = Laya.Sprite3D.instantiate(t);
            return v.addChildToScene3D2(this.role.scene, i), i
        }
        updateFoots() {
            this.setFootRE(this.hp_foot_left, "foot.L"), this.setFootRE(this.hp_foot_right, "foot.R")
        }
        setFootRE(e, t) {
            let i = this.findChild(this.avatar_3p, t);
            e.transform.position = i.transform.position.clone(), this.mFSMLeg.isInState(ee.instance) || this.mFSMLeg.isInState(te.instance) ? (e.transform.rotationEuler = i.transform.rotationEuler.clone(), t.indexOf("L") > -1 ? e.transform.rotate(new Laya.Vector3(0, 0, 81), !1, !1) : e.transform.rotate(new Laya.Vector3(0, 0, -81), !1, !1), e.transform.translate(new Laya.Vector3(0, .15, 0), !1)) : 0 == this.heel_num ? e.transform.rotationEuler = i.transform.rotationEuler.clone() : this.mFSMLeg.isInState(Q.instance) ? t.indexOf("L") > -1 ? e.transform.rotationEuler = this.hp_foot_left_re_def.clone() : e.transform.rotationEuler = this.hp_foot_right_re_def.clone() : e.transform.rotationEuler = i.transform.rotationEuler.clone()
        }
        getDuan(e) {
            return Laya.timer.currTimer - e
        }
        getNow() {
            return Laya.timer.currTimer
        }
        initValue(e, t, i, s, a = {}) {
            this.mRoleINF = e, this.team_id = t, this.mArmy = i, this.Segments = s, this.oPara.hp_value = null != a.hp_max ? a.hp_max : 1, this.hp_cur = this.oPara.hp_value, this.oPara.atk_value = null != a.atk ? a.atk : 1, this.oPara.atk_skill_value = null != a.atk_skill ? a.atk_skill : 0, null != a.atk_range_max && (this.atk_range_max = a.atk_range_max), null != a.atk_range_min && (this.atk_range_min = a.atk_range_min), this.atk_cd = null != a.atk_cd ? a.atk_cd : 1e3, null != a.atk_ready_duan && (this.atk_ready_duan = a.atk_ready_duan), null != a.atk_anim_duan && (this.atk_anim_duan = a.atk_anim_duan), null != a.dead_cd && (this.dead_cd = a.dead_cd)
        }
        refreshAnimSpeed() {
            this.hp_3p_anim.speed = this.move_ctrl.speed_cur / this.WALK_SPEED * 1 / this.WALK_ANIM_DUAN
        }
        wear(e, t) {
            if (e == bt.Reward_Shoes) bt.loadShoesRes(Laya.Handler.create(this, () => {
                let e = this.findChild(this.hp_foot_left, "hp_shoes_left"),
                    i = this.findChild(this.hp_foot_right, "hp_shoes_right");
                K.recoveryComplexSP(e), K.recoveryComplexSP(i);
                let s = K.getSPBySonName(2004, t + "_left"),
                    a = K.getSPBySonName(2005, t + "_right");
                v.addChild(e, s), e.transform.localScale = new Laya.Vector3(.01, .01, .01), s.transform.localScale = new Laya.Vector3(1, 1, 1), v.addChild(i, a), i.transform.localScale = new Laya.Vector3(.01, .01, .01), a.transform.localScale = new Laya.Vector3(1, 1, 1), this.wear_shoes_name = t, this.hp_foot_left && this.hp_foot_right && (this.refreshHpFootHeel(this.hp_foot_left, t), this.refreshHpFootHeel(this.hp_foot_right, t))
            }), t);
            else if (e == bt.Reward_Jewelry) {
                let e = this.findChild(this.avatar_3p, "spine_base");
                if (K.recoveryComplexSP(e), this.wear_jewelry_name = t, "wonderw_armbelt" == t) {
                    let e = K.getSPBySonName(3001, "wonderw_armbelt_l"),
                        t = K.getSPBySonName(3001, "wonderw_armbelt_r"),
                        i = this.findChild(this.avatar_3p, "wonderw_armbelt_l"),
                        s = this.findChild(this.avatar_3p, "wonderw_armbelt_r");
                    e && t && i && s && (i.addChild(e), v.resetLocalTransform(e.transform), s.addChild(t), v.resetLocalTransform(t.transform))
                } else if ("led_wristband" == t) {
                    let e = K.getSPBySonName(3001, "led_wristband_left"),
                        t = K.getSPBySonName(3001, "led_wristband_right"),
                        i = this.findChild(this.avatar_3p, "led_wristband_left"),
                        s = this.findChild(this.avatar_3p, "led_wristband_right");
                    e && t && i && s && (i.addChild(e), v.resetLocalTransform(e.transform), s.addChild(t), v.resetLocalTransform(t.transform))
                } else {
                    let e = K.getSPBySonName(3001, t),
                        i = this.findChild(this.avatar_3p, t);
                    e && i && (i.addChild(e), v.resetLocalTransform(e.transform))
                }
            }
            _t.setMeshRecastShadow(this.avatar_3p)
        }
        refreshHpFootHeel(e, t) {
            let i = e.getChildAt(0);
            for (let e = 0; e < i.numChildren; e++) {
                let s = i.getChildAt(e);
                bt.changeHeelNewMode(s, t)
            }
        }
        takeOff() {
            let e = this.findChild(this.hp_foot_left, "hp_shoes_left"),
                t = this.findChild(this.hp_foot_right, "hp_shoes_right");
            K.recoveryComplexSP(e), K.recoveryComplexSP(t);
            let i = this.findChild(this.avatar_3p, "spine_base");
            K.recoveryComplexSP(i)
        }
        changeRoleMode(e, t) {
            let i = K.getSP(e);
            i ? (this.takeOff(), K.recoverySP(this.avatar_3p), v.addChild(this.role_sp, i), this.setAvatar(), this.wear(0, this.wear_shoes_name), this.wear_jewelry_name.length > 2 && this.wear(1, this.wear_jewelry_name), t.run()) : (K.addSPList(new Y(e), 1, 1), K.preLoad(this, () => {
                this.takeOff(), K.recoverySP(this.avatar_3p);
                let i = K.getSP(e);
                v.addChild(this.role_sp, i), this.setAvatar(), this.wear(0, this.wear_shoes_name), this.wear_jewelry_name.length > 2 && this.wear(1, this.wear_jewelry_name), t.run()
            }))
        }
        addHeel() {
            H.instance.playSound(50014, 1);
            let e = this.findChild(this.hp_foot_left, "HeelStack_Left"),
                t = this.findChild(this.hp_foot_right, "HeelStack_Right"),
                i = bt.getHeelNew(this.wear_shoes_name, !0),
                s = bt.getHeelNew(this.wear_shoes_name, !1);
            v.addChild(e, i), v.addChild(t, s), i.transform.translate(new Laya.Vector3(0, -1e-4 * (this.heel_num - 1), 0)), s.transform.translate(new Laya.Vector3(0, -1e-4 * (this.heel_num - 1), 0)), _t.setMeshRecastShadow(e), _t.setMeshRecastShadow(t)
        }
        delHeel(e) {
            H.instance.playSound(50010, 1), U.mainCH.vibrateShort();
            let t = this.findChild(this.hp_foot_left, "HeelStack_Left"),
                i = this.findChild(this.hp_foot_right, "HeelStack_Right");
            for (let s = 0; s < e; s++) {
                let e = t.getChildAt(t.numChildren - 1);
                v.addChildToScene3D2(this.role.scene, e);
                let s = i.getChildAt(i.numChildren - 1);
                v.addChildToScene3D2(this.role.scene, s)
            }
        }
        refreshRoleSpHight(e, t) {
            this.role_sp.transform.localPositionY = C.axisLerpByDmax(this.role_sp.transform.localPositionY, e, .3, .001 * it.getDelta() * t)
        }
        refreshCapBodySize() {
            this.refreshRoleSpHight(.47 + this.heel_num, 10);
            let e = this.body.colliderShape,
                t = 1.9 + this.heel_num,
                i = 0;
            if (e.orientation == Laya.ColliderShape.SHAPEORIENTATION_UPY) {
                i = t - e.length
            } else i = t;
            if (Math.abs(i) > .001) {
                let s = new Laya.CapsuleColliderShape(.3, t, 1);
                s.localOffset.y = .5 * t, e.destroy(), this.body.colliderShape = s, i < 0 && (this.role.transform.translate(new Laya.Vector3(0, -i, 0), !1), this.role_sp.transform.translate(new Laya.Vector3(0, i, 0), !1))
            }
        }
        changeBodyTypeToBox() {
            this.role.transform;
            this.body.colliderShape.destroy();
            let e = new Laya.CapsuleColliderShape(.6, 2 * this.heel_num + 2, Laya.ColliderShape.SHAPEORIENTATION_UPX);
            e.localOffset.y = .7, this.body.colliderShape = e
        }
        goDead() {
            this.mFSMLeg.isInState(ne.instance) || (this.mFSMLeg.ChangeState(ne.instance), console.warn("this.mFSMLeg.ChangeState(FSMRoleDead.instance);"), X.BroadCast(i.FAILT))
        }
        findChild(e, t) {
            if (e.name == t) return e;
            for (let i = 0; i < e.numChildren; i++) {
                let s = e.getChildAt(i),
                    a = this.findChild(s, t);
                if (a) return a
            }
            return null
        }
        goToStore(e, t) {
            e.addChild(this.role), this.body.enabled = !1, t.addChild(this.role), this.role.transform.localPosition = new Laya.Vector3(0, 0, 0), this.wear(bt.Reward_Shoes, this.wear_shoes_name)
        }
        setEconomic(e = {}) {
            this.win_econ.setPara(e)
        }
        setBypassBarriers(e) {
            this.bypass_barrier_list = e
        }
        getHPMax() {
            return $e.getReviseByOri(this, $e.RV_HP)
        }
        getValuePara(e) {
            return $e.getReviseByOri(this, e)
        }
        behert(e, t, i = !1) {
            t.computeReal(this.role, i);
            let s = t.real;
            if (t.type != et.TYPE_CURE && t.type != et.TYPE_REVIVE) return this.mFSMLeg.isInState(ne.instance) ? 1 : (this.hp_cur = this.hp_cur - s, this.hp_cur <= 0 ? (this.killer_role = e, this.broadCastBehurt(e, t), this.goDead(), 1) : (this.broadCastBehurt(e, t), 0)); {
                if (t.type == et.TYPE_CURE && this.hp_cur <= 0) return;
                if (t.type == et.TYPE_REVIVE && this.hp_cur > 0) return;
                this.hp_cur -= t.real;
                let i = $e.getReviseByOri(this, $e.RV_HP);
                this.hp_cur = Math.min(this.hp_cur, i), t.type == et.TYPE_REVIVE && this.mFSMLeg.ChangeState(oe.instance), this.broadCastBehurt(e, t)
            }
        }
        broadCastBehurt(e, t) {
            X.BroadCast(i.BEHURT_EXE, e, this.role, t)
        }
        flyTo(e, t) {
            let i = this.role.transform.position;
            i.x = e, i.z = t, this.role.transform.position = i
        }
        setBodyColor(e) {
            this.role_mesh.meshRenderer.material.albedoColor = tt.ColorToAlbedo(e)
        }
        goAttack(e) {
            if (e && (this.target_role = e), !this.target_role) return;
            if (this.target_role.destroyed) return;
            let t = $e.getReviseByOri(this, $e.RV_ATK_SPEED_RATE);
            this.atk_cd;
            this.getDuan(this.atk_stime)
        }
        broadcastAttack() {
            let e = this.getTargetRole();
            if (!e) return;
            let t = e.getComponent(At),
                s = Laya.Vector3.distance(this.role.transform.position, e.transform.position) - t.body_radius;
            if (this.atk_range_max >= s) {
                let t = new et(this.role);
                t.setValue(this.oPara.atk_value), X.BroadCast(i.ATK_EXE, this.role, e, t)
            }
        }
        broadcastFSMEvent() {
            X.BroadCast(i.FSM_ENTER, this.role, this.mFSMLeg.getCurrentState())
        }
        playAnim(e) {}
        setTargetRole(e) {
            this.target_role = e, e && this.setTargetPos(e.transform.position.clone())
        }
        getTargetRole() {
            return this.target_role ? this.target_role.destroyed ? null : this.target_role : null
        }
        setTargetPos(e) {
            this.target_pos = e
        }
        isDead() {
            return !!this.mFSMLeg.isInState(ne.instance)
        }
        static isCanBehurt(e, t) {
            if (!e) return null;
            if (e.destroyed) return null;
            let i = e.getComponent(At);
            return t != et.TYPE_REVIVE ? i.mFSMLeg.isInState(ne.instance) || i.mFSMLeg.isInState(re.instance) ? null : i : i.mFSMLeg.isInState(ne.instance) ? i : void 0
        }
        isTargetRoleDead() {
            return null == At.isCanBehurt(this.target_role, et.TYPE_NORMAL)
        }
        getTargetRoleDistance() {
            let e = this.target_role.getComponent(At);
            return Laya.Vector3.distance(this.role.transform.position, this.target_role.transform.position) - e.body_radius
        }
        openThighFix() {
            this.thighLeft.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this.onThighLeftTr), this.shinLeft.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this.onShinLeftTr), this.thighRight.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this.onThighRightTr), this.shinRight.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this.onShinRightTr)
        }
        closeThighLeftFix() {
            this.thighLeft && this.thighLeft.transform.offAll(), this.shinLeft && this.shinLeft.transform.offAll(), this.thighRight && this.thighRight.transform.offAll(), this.shinRight && this.shinRight.transform.offAll()
        }
        onThighLeftTr() {
            this.thighLeft.transform.rotationEuler.clone().z = 0, this.thighLeft.transform.offAll(), this.thighLeft.transform.localRotation = Et.layaQuat(new Laya.Quaternion(.5478562, -.5168931, .4718485, .4582949)), this.thighLeft.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this.onThighLeftTr)
        }
        onThighRightTr() {
            this.thighRight.transform.rotationEuler.clone().z = 0, this.thighRight.transform.offAll(), this.thighRight.transform.localRotation = Et.layaQuat(new Laya.Quaternion(.5416996, .5337954, -.4783298, .4391181)), this.thighRight.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this.onThighRightTr)
        }
        onShinLeftTr() {
            let e = this.shinLeft.transform.rotationEuler;
            e.x = 70.1292, e.y = -165.4145, e.z = 110.9884, this.shinLeft.transform.offAll(), this.shinLeft.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this.onShinLeftTr)
        }
        onShinRightTr() {
            let e = this.shinRight.transform.rotationEuler;
            e.x = 70.1292, e.y = 165.4145, e.z = -110.9884, this.shinRight.transform.offAll(), this.shinRight.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this.onShinRightTr)
        }
    }
    At.ANIM_IDLE = "idle", At.ANIM_STANDBY = "standby", At.ANIM_RUNNING = "running", At.ANIM_READY_ATTACK = "ready_attack",
     At.ANIM_ATTACK = "attack", At.ANIM_DEAD = "dead", At.ANIM_RUNNING_BALANCE = "balance", At.ANIM_RUNNING_CLAP_START = "clap_start", 
     At.ANIM_RUNNING_CLAP_LOOP = "clap_loop", At.ANIM_WIN = "win", At.ANIM_WIN_AROUND = "win_around", At.ANIM_DISABLE = "disable", At.ANIM_ENABLE = "enable";
    class Lt extends At {
        constructor() {
            super(), this.ground_y = 0, this.ground_rx = 0, this.last_pos_z = 0, this.anim_played_0 = !1, this.anim_played_1 = !1, this.anim_loop_num = 0, this.last_single_walk_line_num = 0, this.trigger_obstacle_list = new Array, this.single_walk_line = new Array
        }
        onEnable() {
            super.onEnable(), this.mFSMLeg.ChangeState(Z.instance), this.setFilterBones("Arm_Char|sit_clap_start"), this.setFilterBones("Arm_Char|sit_clap_loop"), this.trigger_obstacle_list.length > 0 && this.trigger_obstacle_list.splice(0, this.trigger_obstacle_list.length), this.single_walk_line.length > 0 && this.single_walk_line.splice(0, this.single_walk_line.length)
        }
        setFilterBones(e) {
            let t = this.hp_3p_anim.getControllerLayer().getAnimatorState(e).clip; - 1 == t.filter_bones_list.indexOf("thigh.L") && t.filter_bones_list.push("thigh.L"), -1 == t.filter_bones_list.indexOf("thigh.R") && t.filter_bones_list.push("thigh.R"), -1 == t.filter_bones_list.indexOf("shin.R") && t.filter_bones_list.push("shin.R"), -1 == t.filter_bones_list.indexOf("shin.L") && t.filter_bones_list.push("shin.L")
        }
        setAvatar() {
            super.setAvatar(), this.thighLeft = this.findChild(this.avatar_3p, "thigh.L"), this.shinLeft = this.thighLeft.getChildAt(0), this.thighRight = this.findChild(this.avatar_3p, "thigh.R"), this.shinRight = this.thighRight.getChildAt(0)
        }
        onUpdate() {
            this.checkObstacleBox(), super.onUpdate();
            let e = this.hp_3p_anim.getControllerLayer().getCurrentPlayState().animatorState.name;
            if ("Arm_Char|cat_walk" == e) {
                let e = this.hp_3p_anim.getControllerLayer().getCurrentPlayState().normalizedTime,
                    t = Math.floor(e);
                t - this.anim_loop_num > 0 && (this.anim_loop_num = t, this.anim_played_0 = !1, this.anim_played_1 = !1), (e -= Math.floor(e)) > .256 && !this.anim_played_0 ? (this.anim_played_0 = !0, X.BroadCast(i.ANIM_WALK_HIT)) : e > .756 && !this.anim_played_1 && (this.anim_played_1 = !0, X.BroadCast(i.ANIM_WALK_HIT))
            } else if ("Arm_Char|sit_clap_loop" == e) {
                let e = this.hp_3p_anim.getControllerLayer().getCurrentPlayState().normalizedTime,
                    t = Math.floor(e);
                t - this.anim_loop_num > 0 && (this.anim_loop_num = t, this.anim_played_0 = !1, this.anim_played_0 = !1), (e -= Math.floor(e)) >= 0 && !this.anim_played_0 && (this.anim_played_0 = !0, X.BroadCast(i.ANIM_CLAP))
            }
            let t = this.role.transform.position.z - this.last_pos_z;
            this.role.transform.position.z > 5 && t < 0 && this.mFSMLeg.isInState(Q.instance) ? this.goDead() : this.last_pos_z = this.role.transform.position.z
        }
        initValue(e, t, i, s, a = {}) {
            super.initValue(e, t, i, s, a), this.oPara.hp_value = null != a.hp_max ? a.hp_max : 100, this.hp_cur = this.oPara.hp_value, this.oPara.atk_value = null != a.atk ? a.atk : 30, this.atk_range_max = null != a.atk_range_max ? a.atk_range_max : 1.8, this.heel_num = 0
        }
        recoveryModel() {}
        changeModel(e) {}
        changeCapLock() {}
        changeCapMove() {}
        playAnim(e) {
            super.playAnim(e), this.hp_3p_anim && (this.hp_3p_anim.speed = 1, e == At.ANIM_IDLE ?
                 (this.hp_3p_anim.speed = 1e-4, this.hp_3p_anim.play("Arm_Char|_Idle_1")) : e == At.ANIM_STANDBY ? 
                 this.hp_3p_anim.play("Arm_Char|_Idle_1", 0, 0) : e == At.ANIM_RUNNING ? 
                 (this.hp_3p_anim.speed = this.move_ctrl.speed_cur / this.WALK_SPEED * 1 / this.WALK_ANIM_DUAN, 
                 this.hp_3p_anim.crossFade("Arm_Char|cat_walk", .15, 0, 0), this.anim_played_0 = !1, this.anim_played_1 = !1,
                  this.anim_loop_num = 0) : e == At.ANIM_RUNNING_BALANCE ? 
                  (this.hp_3p_anim.speed = this.move_ctrl.speed_cur / this.WALK_SPEED * 1 / this.WALK_ANIM_DUAN, 
                  this.hp_3p_anim.crossFade("Arm_Char|cat_walk", .15, 0, 0), this.anim_played_0 = !1, this.anim_played_1 = !1, 
                  this.anim_loop_num = 0) : e == At.ANIM_RUNNING_CLAP_START ? this.hp_3p_anim.play("Arm_Char|sit_clap_start", 0, 0) :
                   e == At.ANIM_RUNNING_CLAP_LOOP ? (this.hp_3p_anim.play("Arm_Char|sit_clap_loop", 0, 0), this.anim_played_0 = !1,
                    this.anim_played_1 = !1, this.anim_loop_num = 0) : e == At.ANIM_DEAD ? this.hp_3p_anim.crossFade("Arm_Char|hit_and_fall", .15, 0, 0) :
                     e == At.ANIM_WIN ? this.hp_3p_anim.crossFade("Arm_Char|win_dance_02", .15, 0, 0) :
                      e == At.ANIM_WIN_AROUND ? this.hp_3p_anim.crossFade("Arm_Char_cat_walk_around", .15, 0, 0) :
                       e == At.ANIM_DISABLE ? this.hp_3p_anim.enabled = !1 : e == At.ANIM_ENABLE && (this.hp_3p_anim.enabled = !0))
        }
        onCollisionEnter(e) {
            if (this.mFSMLeg.isInState(ne.instance)) return;
            let t = e.other.owner;
            if (t.name.indexOf("Podium") > -1) this.mFSMLeg.ChangeState(se.instance);
            else if (t.name.indexOf("Cube.022") > -1) {
                if (e.contacts[0].normal.y < -.8 && (this.ground_y = e.contacts[0].positionOnA.y), (this.mFSMLeg.isInState(te.instance) || this.mFSMLeg.isInState(ee.instance)) && this.getDuan(this.dead_stime) > 500 && this.mFSMLeg.ChangeState(Q.instance), this.mFSMLeg.isInState($.instance) && Laya.timer.once(200, this, () => {
                        this.mFSMLeg.isInState(ne.instance) || this.mFSMLeg.ChangeState(Q.instance)
                    }), this.mFSMLeg.isInState(Z.instance)) return;
                t.transform.position.y - this.ground_y > .9 && (this.col_dead_ground_pos_y = t.transform.position.y)
            } else t.name.indexOf("single_walk_line") > -1 ? Laya.timer.once(20, this, () => {
                this.single_walk_line.length > 0 && H.instance.playSound(50008, 1)
            }) : t.name.indexOf("walk_line_pair") > -1 ? H.instance.playSound(50008, 1) : t.name.indexOf("walk_line_single") > -1 && (this.walk_line_beam_rex = t.transform.rotationEuler.x)
        }
        onCollisionExit(e) {
            if (this.mFSMLeg.isInState(ne.instance)) return;
            let t = e.other.owner;
            if (t.name.indexOf("Cube.022") > -1 || t.name.indexOf("Obstacle") > -1) this.checkStage();
            else if (t.name.indexOf("single_walk_line") > -1) {
                Laya.timer.once(20, this, () => {
                    0 == this.single_walk_line.length && H.instance.playSound(50012, 1)
                });
                let e = this.single_walk_line.indexOf(t);
                e > -1 && this.single_walk_line.splice(e, 1), 0 == this.single_walk_line.length && (this.walk_line_rail_rex = 0)
            } else t.name.indexOf("walk_line_pair") > -1 && (H.instance.playSound(50012, 1), (this.walk_line_pair = null) && (this.walk_line_rail_rex = 0))
        }
        onTriggerEnter(e) {
            if (this.mFSMLeg.isInState(ne.instance)) return;
            let t = e.owner;
            if (console.log(t.name), "Gem" == t.name) K.recoverySP(t), X.BroadCast(i.DEM);
            else if ("HeelPart" == t.name) {
                if (this.getDuan(this.last_add_heel_time) < 100) return;
                this.last_add_heel_time = this.getNow(), this.heel_num++, this.addHeel(), t.addComponent(W)
            } else if ("InGameRewardCollectable" == t.name) {
                let e = t.getChildByName("ShoeScaleParent");
                if (e.numChildren <= 2);
                else {
                    let t = e.getChildAt(2).name.split("_")[0];
                    X.BroadCast(i.CHANGE_SHOES, t)
                }
                K.recoveryComplexSP(t, !0)
            } else if ("RotatingObstacle" == t.name) {
                let e = t.getComponent(Laya.PhysicsCollider);
                if (e.isTrigger) {
                    if (e.isTrigger = !1, this.heel_num = this.heel_num - 1, this.heel_num < 0) return this.heel_num = 0, void this.goDead();
                    this.delHeel(1), this.refreshCapBodySize()
                }
            } else if ("GrindPad" == t.name) {
                if (t.getComponent(Laya.PhysicsCollider).collisionGroup = q.null_category, this.heel_num = this.heel_num - 1, this.heel_num < 0) return this.heel_num = 0, void this.goDead();
                this.delHeel(1), this.refreshCapBodySize()
            } else if ("Obstacle" == t.name) {
                let e = t.getComponent(Laya.PhysicsCollider);
                e.isTrigger && (this.trigger_obstacle_list.push(t), e.isTrigger = !1)
            } else if (t.name.indexOf("FinishStep") > -1) {
                let e = t.getComponent(Laya.PhysicsCollider);
                if (e.isTrigger) {
                    if (!(this.heel_num > 0)) {
                        this.mFSMLeg.ChangeState(ie.instance);
                        let e = Number(t.name.split("_")[1]) - 1;
                        return void Laya.timer.once(1e3, this, () => {
                            X.BroadCast(i.WIN, e)
                        })
                    }
                    this.heel_num--, this.delHeel(1), this.refreshCapBodySize(), this.createTempGround(t.scene, t.transform.position.y, t.transform.position.z), e.isTrigger = !1
                }
            }
        }
        checkObstacleBox() {
            this.mFSMLeg.isInState(ne.instance) || Laya.timer.callLater(this, () => {
                if (this.mFSMLeg.isInState(ne.instance)) return;
                if (this.mFSMLeg.isInState(ee.instance) || this.mFSMLeg.isInState(te.instance)) {
                    let e = this.single_walk_line.length;
                    if (1 == this.last_single_walk_line_num && 2 == e) this.role.transform.rotationEuler = new Laya.Vector3(0, 0, 0);
                    else if (2 == this.single_walk_line.length) {
                        let e = Math.abs(this.single_walk_line[0].transform.position.x - this.single_walk_line[1].transform.position.x),
                            t = (this.single_walk_line[0].transform.position.x + this.single_walk_line[1].transform.position.x) / 2,
                            i = t + .5 * e,
                            s = t - .5 * e;
                        this.role.transform.position.x < s ? this.move_ctrl.updateREZRailsAuto(this.role.transform.position.x - s) : this.role.transform.position.x > i ? this.move_ctrl.updateREZRailsAuto(this.role.transform.position.x - i) : this.move_ctrl.updateREZRailsAuto(0)
                    } else if (1 == this.single_walk_line.length) {
                        let e = .2,
                            t = this.single_walk_line[0].transform.position.x,
                            i = t + .5 * e,
                            s = t - .5 * e;
                        this.role.transform.position.x < s ? this.move_ctrl.updateREZRailsAuto(this.role.transform.position.x - s) : this.role.transform.position.x > i ? this.move_ctrl.updateREZRailsAuto(this.role.transform.position.x - i) : this.move_ctrl.updateREZRailsAuto(0)
                    } else if (this.walk_line_pair) {
                        let e = 2.086,
                            t = this.walk_line_pair.transform.position.x,
                            i = t + .5 * e,
                            s = t - .5 * e;
                        this.role.transform.position.x < s ? this.move_ctrl.updateREZRailsAuto(this.role.transform.position.x - s) : this.role.transform.position.x > i ? this.move_ctrl.updateREZRailsAuto(this.role.transform.position.x - i) : this.move_ctrl.updateREZRailsAuto(0)
                    }
                    this.last_single_walk_line_num = e
                }
                this.single_walk_line.forEach(e => {
                    if (this.getDuan(e.col_time) > 200) {
                        let t = this.single_walk_line.indexOf(e);
                        t > -1 && this.single_walk_line.splice(t, 1)
                    }
                }), this.walk_line_pair && this.getDuan(this.walk_line_pair.col_time) > 200 && (this.walk_line_pair = null);
                let e = 0,
                    t = null;
                for (let i = 0; i < this.trigger_obstacle_list.length; i++) {
                    let s = this.trigger_obstacle_list[i];
                    s.transform.position.y + 1 - this.ground_y > e && (e = s.transform.position.y + 1 - this.ground_y, t = s)
                }
                if (Math.round(e) > 0) {
                    if (this.heel_num = this.heel_num - Math.round(e), this.heel_num < 0) return this.heel_num = 0, void this.goDead();
                    this.delHeel(Math.round(e)), this.refreshCapBodySize(), this.createTempGround(t.scene, t.transform.position.y + 1, t.transform.position.z - .5);
                    let i = this.findParent(t, "Obstacles");
                    if (i)
                        for (let e = 0; e < i.numChildren; e++) {
                            let s = i.getChildAt(e);
                            if (s.name.indexOf("RotatingObstacle") > -1);
                            else if (s.name.indexOf("Obstacle") > -1) {
                                if (s = s.getChildAt(0), 0 == Math.abs(s.transform.position.z - t.transform.position.z)) {
                                    let e = s.getComponent(Laya.PhysicsCollider);
                                    e ? e.isTrigger = !1 : console.log()
                                }
                            } else if (s.name.indexOf("Set") > -1 || s.name.indexOf("set") > -1)
                                for (let e = 0; e < s.numChildren; e++) {
                                    let i = s.getChildAt(e);
                                    if (i.name.indexOf("Obstacle") > -1) {
                                        if (!(i = i.getChildAt(0))) continue;
                                        if (0 == Math.abs(i.transform.position.z - t.transform.position.z)) {
                                            let e = i.getComponent(Laya.PhysicsCollider);
                                            e ? e.isTrigger = !1 : console.log()
                                        }
                                    }
                                }
                        }
                } else if (this.col_dead_ground_pos_y > -999) {
                    let e = this.col_dead_ground_pos_y - this.ground_y;
                    if (Math.round(e) > 0) {
                        if (this.heel_num = this.heel_num - Math.round(e), this.heel_num < 0) return this.heel_num = 0, void this.goDead();
                        this.delHeel(Math.round(e)), this.refreshCapBodySize(), this.createTempGround(this.role.scene, this.col_dead_ground_pos_y, this.role.transform.position.z + .3)
                    }
                }
                if (this.trigger_obstacle_list.length > 0 && this.trigger_obstacle_list.splice(0, this.trigger_obstacle_list.length), this.mFSMLeg.isInState(Q.instance) || this.mFSMLeg.isInState($.instance)) {
                    let e = this.rails_speed_cur > 30 ? -20 : -4;
                    if (this.role.transform.position.y - this.ground_y < e) return this.goDead(), void(this.rails_speed_cur = 1)
                } else if (this.mFSMLeg.isInState(ee.instance) || this.mFSMLeg.isInState(te.instance))
                    if (Jt.instance.walk_line_lowest_y < 999) {
                        let e = this.rails_speed_cur > 30 ? -20 : -4;
                        if (this.role.transform.position.y - Jt.instance.walk_line_lowest_y < e) return void this.goDead()
                    } else if (this.role.transform.position.y - this.ground_y < -4) return void this.goDead();
                this.col_dead_ground_pos_y = -9999
            })
        }
        findParent(e, t) {
            let i = null;
            if ((i = e.parent).name == t) return i;
            for (; null != i || !(i instanceof Laya.Scene3D);) {
                if (!(i = i.parent)) return null;
                if (i.name == t) return i
            }
        }
        createTempGround(e, t, i) {
            let s = new Laya.Sprite3D;
            e.addChild(s), s.transform.position = new Laya.Vector3(0, t - .5, i);
            let a = s.addComponent(Laya.PhysicsCollider),
                n = new Laya.BoxColliderShape(5, 1, 2);
            a.colliderShape = n, a.collisionGroup = q.road_category, a.canCollideWith = q.road_mask
        }
        onCollisionStay(e) {
            let t = e.other.owner;
            t.name.indexOf("Cube.022") > -1 && (this.ground_rx = t.transform.rotationEuler.x), (t.name.indexOf("Cube.022") > -1 || t.name.indexOf("FinishStep") > -1 || t.name.indexOf("Podium") > -1 || t.name.indexOf("walk_line") > -1) && (this.ground_y = e.contacts[0].positionOnA.y), t.name.indexOf("single_walk_line") > -1 ? (t.col_time = this.getNow(), -1 == this.single_walk_line.indexOf(t) && this.single_walk_line.push(t), this.walk_line_rail_rex = t.transform.rotationEuler.x, this.ground_rx = 0) : t.name.indexOf("walk_line_pair") > -1 && (t.col_time = this.getNow(), this.walk_line_pair = t, this.walk_line_rail_rex = t.transform.rotationEuler.x, this.ground_rx = 0)
        }
        checkStage() {
            if (this.mFSMLeg.isInState(ne.instance)) return;
            let e = null;
            for (let t = 0; t < this.Segments.numChildren; t++) {
                let i = this.Segments.getChildAt(t),
                    s = i.transform.position.z - this.role.transform.position.z;
                if (!(i.name.indexOf("Finish") > -1))
                    if (i.name.indexOf("Ground") > -1) Math.abs(s) < .4 && (this.ground_y = i.transform.position.y);
                    else if (i.name.indexOf("SwipeRails") > -1)
                    for (let t = 0; t < i.numChildren; t++) {
                        let s = i.getChildAt(t).transform.position.z - this.role.transform.position.z;
                        if (Math.abs(s) < .5) {
                            e = i;
                            break
                        }
                    } else if (Math.abs(s) < .5) {
                        e = i;
                        break
                    }
            }
            e && (this.SegmentCur = e, this.SegmentCur.name.indexOf("Beam") > -1 ? this.mFSMLeg.ChangeState($.instance) : (this.SegmentCur.name.indexOf("Rails") > -1 || this.SegmentCur.name.indexOf("TripleRail") > -1) && this.mFSMLeg.ChangeState(ee.instance))
        }
    }
    class Ct extends Laya.Script {
        constructor() {
            super(), this.idle_dpos = v.unityToLayaPos(new Laya.Vector3(0, 5.5, -7.7)), this.idle_ro = v.unityToLayaRE(new Laya.Vector3(20, 0, 0)), this.running_dpos = v.unityToLayaPos(new Laya.Vector3(0, 5.5, -7.7)), this.running_dpos_lerp = .3, this.running_rex_list = [20, 15.14, 14.9], this.win_super_dpos = v.unityToLayaPos(new Laya.Vector3(-5.21, 13.05, 32.19)), this.win_dpos_lerp = .3, this.win_super_ro_halfway = v.unityToLayaRE(new Laya.Vector3(80, 120, 0)), this.win_super_ro = v.unityToLayaRE(new Laya.Vector3(20, 155.559, 0)), this.win_ro_lerp = .2, this.dz = 0, this.mStateMachine = new b(this)
        }
        onEnable() {
            this.camera = this.owner, this.camera.clearColor = new Laya.Vector4(99 / 255, 242 / 255, 243 / 255, 1), this.mStateMachine.ChangeState(E.instance)
        }
        onDisable() {}
        onUpdate() {
            this.mStateMachine.Update()
        }
        getFSM() {
            return this.mStateMachine
        }
        getFOVByHeelNum(e) {
            return 60 - 2 * e
        }
        getDyByHeelNum(e) {
            return e < 4 ? 5.5 + .15 * e : 5.5 + .5 * e
        }
        getRexByHeelNum(e) {
            return e < 3 ? this.running_rex_list[e] : 14.9
        }
        moveToAimObjectPosition(e) {
            var t = new Laya.Vector3;
            Laya.Vector3.add(this.idle_dpos, e, t), this.camera.transform.position = t
        }
        setAimObjectAndRun(e) {
            this.aim_object = e, this.mStateMachine.ChangeState(A.instance)
        }
        getDuan(e) {
            return Laya.timer.currTimer - e
        }
        getNow() {
            return Laya.timer.currTimer
        }
        transformToRunning() {
            if (!this.aim_object) return;
            if (this.aim_object.destroyed) return;
            let e = this.camera.transform,
                t = this.aim_object.getComponent(Lt);
            if (t) {
                let i = Laya.MathUtil.lerp(e.position.x, this.aim_object.transform.position.x, .05),
                    s = 0;
                s = t.mFSMLeg.isInState(te.instance) || t.mFSMLeg.isInState(ee.instance) ? Laya.MathUtil.lerp(e.position.y, t.role.transform.position.y + this.getDyByHeelNum(t.heel_num), .2) : Laya.MathUtil.lerp(e.position.y, t.ground_y + this.getDyByHeelNum(t.heel_num), .1), this.dz = Laya.MathUtil.lerp(this.dz, t.heel_num > 3 ? 2 * (t.heel_num - 3) : 0, .1);
                let a = 1 - t.ground_rx / 90;
                t.ground_rx > 0 && (a = 1);
                let n = this.aim_object.transform.position.z - 7.7 + .3 - this.dz,
                    r = Laya.MathUtil.lerp(this.camera.fieldOfView, this.getFOVByHeelNum(t.heel_num) * a, .1),
                    o = Laya.MathUtil.lerp(e.rotationEuler.x, this.getRexByHeelNum(t.heel_num), .1);
                e.position = new Laya.Vector3(i, s, n), e.localRotationEuler.x = o, this.camera.fieldOfView = r
            }
        }
        transformToWinSuper() {
            if (!this.aim_object) return;
            if (this.aim_object.destroyed) return;
            let e = this.camera.transform,
                t = Laya.MathUtil.lerp(this.camera.fieldOfView, 60, .1);
            this.camera.fieldOfView = t;
            let i = new Laya.Vector3;
            Laya.Vector3.add(this.aim_object.transform.position, this.win_super_dpos, i);
            let s = .001 * it.getDelta() * 15;
            C.Vec3LerpByDmax(e.position, i, new Laya.Vector3(.05, .05, .05), new Laya.Vector3(s, s, s), i), e.position = i;
            let a = new Laya.Vector3,
                n = .001 * it.getDelta() * 90;
            C.reVec3LerpByDmax(e.rotationEuler, this.win_super_ro, new Laya.Vector3(.05, .05, .05), new Laya.Vector3(n, n, n), a), e.rotationEuler = a
        }
        goWinSuper(e) {
            this.aim_object = e, this.mStateMachine.ChangeState(L.instance)
        }
    }
    class vt {
        constructor() {
            this.team_list = new Array
        }
        addRole(e, t) {
            let i = this.getTeamByID(e);
            i || (i = this.addTeam()), i.addOne(t)
        }
        removeRole(e) {
            for (let t = 0; t < this.team_list.length; t++) {
                let i = this.team_list[t];
                if (i) {
                    if (i.remove(e)) return
                }
            }
        }
        getRole(e, t) {
            let i = this.getTeamByID(e);
            if (i) return i.role_list[t]
        }
        getFriends(e, t, i) {
            let s = this.getTeamByRole(e);
            s && s.role_list.forEach(e => {
                i.call(t, e)
            })
        }
        getEnemys(e, t, i) {
            let s = this.getTeamByRole(e);
            s && this.team_list.forEach(e => {
                e && e.id != s.id && e.role_list.forEach(e => {
                    i.call(t, e)
                })
            })
        }
        getTeamAllRoles(e, t, i) {
            let s = this.getTeamByID(e);
            s && s.role_list.forEach(e => {
                i.call(t, e)
            })
        }
        getTeamByID(e) {
            return this.team_list[e]
        }
        getTeamByRole(e) {
            for (let t = 0; t < this.team_list.length; t++) {
                let i = this.team_list[t];
                if (i && i.isInTeam(e)) return i
            }
            return null
        }
        addTeam() {
            let e = new wt(this.team_list.length);
            return this.team_list[e.id] = e, e
        }
        removeTeam(e) {
            this.team_list[e] = null
        }
    }
    class wt {
        constructor(e) {
            this.id = e, this.role_list = new Array
        }
        addOne(e) {
            this.role_list.push(e)
        }
        remove(e) {
            let t = this.role_list.indexOf(e);
            return t > -1 && (this.role_list.splice(t, 1), !0)
        }
        isInTeam(e) {
            return this.role_list.indexOf(e) > -1
        }
    }
    class It {
        constructor(e, t, i, s, a) {
            this._identifier = -1, this._centerX = -1, this._centerY = -1, this.enable = !0, this.touch_panel = e, this.caller = t, this.touch_panel.on(Laya.Event.MOUSE_DOWN, this, this.onMouseDown, [i]), this.touch_panel.on(Laya.Event.MOUSE_UP, this, this.onMouseUp, [s]), this.touch_panel.on(Laya.Event.MOUSE_MOVE, this, this.onMouseMove, [a])
        }
        destroy() {
            this.touch_panel.off(Laya.Event.MOUSE_DOWN, this, this.onMouseDown), this.touch_panel.off(Laya.Event.MOUSE_UP, this, this.onMouseUp), this.touch_panel.off(Laya.Event.MOUSE_MOVE, this, this.onMouseMove), this.touch_panel = null, this.caller = null
        }
        get bgX() {
            return this._centerX
        }
        get bgY() {
            return this._centerY
        }
        Joystick2DTo3DForward(e, t) {
            return Math.atan2(e, t) + Math.PI
        }
        onMouseDown(e, t) {
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();
            var i = t;
            return this._identifier = 1, this._centerX = i.stageX / a.getScaleRate(), this._centerY = i.stageY / a.getScaleRate(), null != e && this.enable && e.call(this.caller), !0
        }
        onMouseUp(e, t) {
            return this.exeUp(e), !0
        }
        exeUp(e) {
            this._identifier = -1, this._centerX = -1, this._centerY = -1, null != e && this.enable && e.call(this.caller)
        }
        onMouseMove(e, t) {
            var i = t;
            if (1 == this._identifier) {
                this.curX = i.stageX / a.getScaleRate(), this.curY = i.stageY / a.getScaleRate();
                let t = this.curX - this._centerX,
                    s = this.curY - this._centerY;
                return null != e && this.enable && e.call(this.caller, t, s), [t, s]
            }
        }
        resetCenterByCurPoint() {
            this._centerX = this.curX, this._centerY = this.curY
        }
    }
    class Tt extends It {
        constructor(e, t, i, s, n, r, o, l = !0) {
            super(e, t, i, s, n), this.radius = 100, this.up_hide = !0, this.def_centerX = -1, this.def_centerY = -1, this.bg = new Laya.Image, this.bg.skin = Tt.BG_SKIN, this.bg.anchorX = .5, this.bg.anchorY = .5, this.touch_panel.addChild(this.bg), this.dot = new Laya.Image, this.dot.skin = Tt.DOT_SKIN, this.dot.anchorX = .5, this.dot.anchorY = .5, this.touch_panel.addChild(this.dot), this.def_centerX = r / a.getScaleRate(), this.def_centerY = o / a.getScaleRate(), this.up_hide = l, this.hideRing()
        }
        destroy() {
            super.destroy(), this.bg.destroy(), this.dot.destroy()
        }
        onMouseDown(e, t) {
            let i = super.onMouseDown(e, t);
            return i && this.hideRing(), i
        }
        onMouseUp(e, t) {
            let i = super.onMouseUp(e, t);
            return i && this.hideRing(), i
        }
        onMouseMove(e, t) {
            let i = super.onMouseMove(e, t);
            return i && this.moveDot(i[0], i[1]), i
        }
        moveDot(e, t) {
            if (Math.sqrt(e * e + t * t) <= this.radius) this.dot.pos(this._centerX + e, this._centerY + t);
            else {
                let i = Math.atan2(t, e);
                this.dot.pos(this._centerX + Math.cos(i) * this.radius, this._centerY + Math.sin(i) * this.radius)
            }
        }
        showRing() {
            this.up_hide && (this.bg.visible = this.dot.visible = !0), this.dot.x = this.bg.x = this._centerX, this.dot.y = this.bg.y = this._centerY, this.radius = .5 * (this.bg.width - this.dot.width)
        }
        hideRing() {
            this.up_hide && (this.bg.visible = this.dot.visible = !1), this.bg.x = this.dot.x = this.def_centerX, this.bg.y = this.dot.y = this.def_centerY
        }
        resetCenterByCurPoint() {
            super.resetCenterByCurPoint(), this.dot.x = this.bg.x = this._centerX, this.dot.y = this.bg.y = this._centerY
        }
    }
    Tt.BG_SKIN = "Joystick/rocker_bg.png", Tt.DOT_SKIN = "Joystick/rocker_dot.png";
    class xt extends e.test.SettingUI {
        constructor() {
            super(), a.setScale(this), Zt.instance.screenAdaptation(this.root), this.nativeAd.y = a.height() - this.nativeAd.height
        }
        onOpened() {
            console.log("设置")
            y.sound_switch=!VkApp.isSoundMute
            VkApp.removeLoadingCircle();//删除loading
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
                VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            S.normal_screen && Laya.timer.once(S.delay_screen_time, this, () => {
                U.mainCH.showInterstitialAd()
            }), this.initBtn(), this.initSound(), this.initShake()
        }
        initBtn() {
            this.btnCLose.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnClose]), 
            this.btnSound.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnSound]), 
            this.btnShake.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnShake])
        }
        initSound() {
            y.sound_switch ? (H.instance.activeAllSound(!0), this.btnSound.skin = "img/setting/lv-icon.png",  
            this.lbSoundText.font="Arial", 
            this.lbSoundText.text = window.getLanguageByKey("Open"), 
            this.ivSound.skin = "img/setting/icon_voice_on.png") : 
            (H.instance.activeAllSound(!1), this.btnSound.skin = "img/setting/h-icon.png",this.lbSoundText.text = window.getLanguageByKey("Closing"),
             this.ivSound.skin = "img/setting/icon_voice_off.png")
        }
        initShake() {
            y.shake_switch ? (this.btnShake.skin = "img/setting/lv-icon.png",
             this.lbShakeText.text = window.getLanguageByKey("Open"),
             this.ivShake.skin = "img/setting/vibrator_on.png") : (this.btnShake.skin = "img/setting/h-icon.png", 
             this.lbShakeText.text = window.getLanguageByKey("Closing"), this.ivShake.skin = "img/setting/vibrator_off.png")
        }
        onBtnSound() {
            y.sound_switch = 1 == y.sound_switch ? 0 : 1, this.initSound()
            VkApp.isSoundMute=!y.sound_switch
            if (VkApp.isSoundMute) {
                //游戏内的静音，Laya范例
                CoinAppAudio.stopAll();
            } else {
                //游戏内的开启背景音乐,Laya范例
                CoinAppAudio.playMusic(CoinAppAudio.bgm);
            }
            VkApp.setItem(CoinAppAudio.music_state_key,VkApp.isSoundMute)
        }
        onBtnShake() {
            y.shake_switch = 1 == y.shake_switch ? 0 : 1, this.initShake()
        }
        onBtnClose() {
            console.info("点击关闭"), this.closeSelf(), this.close()
        }
        closeSelf() {
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();

            VkApp.showRandomInterAd();// 主界面 按钮关闭 随机插屏广告
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

           
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 230, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 300, null);
            this.btnCLose.offAll(Laya.Event.CLICK), this.btnSound.offAll(Laya.Event.CLICK), this.btnShake.offAll(Laya.Event.CLICK)
        }
    }
    xt.SCENE_NAME = "test/Setting.scene";
    class kt {
        constructor() {
            kt.instance = this, this.initInfo()
        }
        init(e, t, i) {
            this.camera = e, this.scene = t
        }
        showGoldBanner() {
            this.gold_banner && (this.gold_banner.visible = !0), console.info("显示金币")
        }
        hideGoldBanner() {
            this.gold_banner && (this.gold_banner.visible = !1), console.info("隐藏金币")
        }
        setGoldLabel() {
            if (console.info("goldBanner：", this.gold), this.gold) {
                let e = f.getGold();
                console.info("goldBanner000：", e), this.gold.text = Zt.instance.conversion(e)
            }
        }
        initInfo() {
            Laya.loader.create("prefab/banner_gold.json", Laya.Handler.create(this, () => {
                var e = new Laya.Prefab;
                
                e.json = Laya.Loader.getRes("prefab/banner_gold.json"), this.gold_banner = e.create(), this.gold_banner.zOrder = 99, Laya.stage.addChild(this.gold_banner), a.setScale(this.gold_banner),
                 this.gold = this.gold_banner.getChildByName("num"), 
                 this.gold_banner.x = 11.5 * a.getScaleRate(), this.setGoldLabel(), this.autoPosHome(), this.hideGoldBanner(), this.gold_banner.on(Laya.Event.CLICK, this, this.onBtnAddGold)
            }))
        }
        onBtnAddGold() {}
        autoPosHome() {
            Laya.Browser.width, Laya.Browser.height, this.gold_banner.y = 30 * a.getScaleRate(), this.gold_banner.x = (a.width() - 130) * a.getScaleRate()
        }
    }
    class Bt extends e.test.DefineSkinUI {
        constructor() {
            super(), this.itemData = null, a.setScale(this), Zt.instance.screenAdaptation(this.root), Zt.instance.screenAdaptation(this.top_banner, 50), this.nativeAd.y = a.height() - this.nativeAd.height
        }
        onOpened(e) {
            S.normal_screen && Laya.timer.once(S.delay_screen_time, this, () => {
                U.mainCH.showInterstitialAd()
            }), this.itemData = e, this.initData(), this.initBtn()
        }
        initBtn() {
            this.btnAtOnce.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnGetVideo]), this.btnClose.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnClose]), Zt.instance.delay(this.btnClose)
        }
        initData() {
            this.ivItem.skin = "img/skin/" + this.itemData.ic
        }
        onBtnGetVideo() {
            U.mainCH.showVideoAd(e => {
                e && (d.incItem(this.itemData), 1 == this.itemData.sid && f.setPlayerSkin(this.itemData.id),
                 2 == this.itemData.sid && f.setPlayerJewel(this.itemData.id), Jt.instance && Jt.instance.refreshGaogen(this, () => {
                    Jt.instance.refreshRole(this, () => {
                        Jt.instance.refreshShowItem(), this.onBtnClose()
                    })
                }))
            })
        }
        onBtnClose() {
            this.close()
        }
    }
    Bt.SCENE_NAME = "test/DefineSkin.scene";
    class Rt extends e.test.FailSceneUI {
        constructor() {
            super(), this.addGold = 0, a.setScale(this), Zt.instance.screenAdaptation(this.root), this.nativeAd.y = a.height() - this.nativeAd.height
        }
        onOpened() {
           console.log("失败")
           window.GameOver=true
           Laya.timer.once(1500,this,()=>{
            //Taylor 插屏
            console.log("Sy --- 插屏");
            VkApp.showInterstitial(); //显示插屏
            window.GameOver=false
             })
           let e = f.getGradeCyclic();
            console.info("当前关卡：", e);
           var t = bt.getDrama(e);
           S.normal_screen && Laya.timer.once(S.delay_screen_time, this, () => {
            U.mainCH.showInterstitialAd()
        }), y.is_game_back = !0;
        
        
        this.addGold = t.f_gold, this.lbGold.text = "+" + this.addGold,
         this.lbGoldVideo.text = "+" + 3 * this.addGold, console.info("当前关卡drama：", t), 
         S.show_game_portalAd && console.info("显示九宫格"), this.initBtn()
          
                        VkApp.showNineBoxView(10, "золота", (num) => {//宝箱
                            if(num>0){
                                this.addGold+=num;
                                this.lbGold.text = "+" + this.addGold
                            }
                        },()=>{
                            VkApp.showRecommendGames("full_screen");// 结算关闭 显示全屏界面
                            // VkApp.showMoreGameBtn(); //新增全屏按钮
                            // VkApp.showShareBtn(); //分享按钮
                
                            // if (!window.end) {
                            //     VkApp.showBanner(); //显示底部banner矩阵
                            // }
                            // VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
                            // //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
                            // VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
                            // VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
                            // VkApp.showRecommendGames("singleIcon_402", 10, null, 210, null);
                            // VkApp.showRecommendGames("singleIcon_404", 10, null, 280, null);
                        });
         
        }
        initBtn() {
            this.btnGetVideo.on(Laya.Event.CLICK, this, this.onBtnGetVideo),
             this.btnGetNormal.on(Laya.Event.CLICK, this, this.onBtnGetNormal),
              Zt.instance.delay(this.btnGetNormal)
        }
        onBtnGetNormal() {
            if( window.GameOver){
                    return
            }
            console.info("普通领取", this.addGold), H.instance.playSound(50014, 1), 
            f.addGold(this.addGold), f.getGold(), kt.instance.setGoldLabel(), f.saveData(), y.isShowAd = !0;
            let e = Jt.instance.getLockItem();
            S.showTyeShoes() && e ? (
                // y.isChallengeItem || 
                // Zt.instance.openScene(Bt.SCENE_NAME, !1, e)
                // ,
             y.fashionItem = null, y.challengeItem = null, Laya.Scene.close(Rt.SCENE_NAME), Zt.instance.reloadLevelMapAuto()) : 
             (y.fashionItem = null, y.challengeItem = null, Laya.Scene.close(Rt.SCENE_NAME), Zt.instance.reloadLevelMapAuto())
        }
        onBtnGetVideo() {
          
            console.info("三倍领取"), H.instance.playSound(50014, 1), U.mainCH.showVideoAd(e => {
                if (e) {
                    f.addGold(3 * this.addGold), kt.instance.setGoldLabel(), y.isShowAd = !0;
                    let e = Jt.instance.getLockItem();
                    S.showTyeShoes() && e ? (
                    // y.isChallengeItem || Zt.instance.openScene(Bt.SCENE_NAME, !1, e)
                    // , 
                    y.fashionItem = null, y.challengeItem = null, Laya.Scene.close(Rt.SCENE_NAME), 
                    Zt.instance.reloadLevelMapAuto()) : (y.fashionItem = null, y.challengeItem = null, Laya.Scene.close(Rt.SCENE_NAME),
                     Zt.instance.reloadLevelMapAuto())
                }
            })
        }
        onDisable() {
            window.gameStart=false
            window.showFree=false
        }
    }
    Rt.SCENE_NAME = "test/FailScene.scene";
    class Mt extends Laya.Script {
        constructor() {
            super(), this.positionType = 1, this.switchType = 0, this.start_time = 0
        }
        onEnable() {
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮
    
            if (!window.end) {
                //VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
                VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
                // VkApp.showRecommendGames("singleIcon_402", 10, null, 210, null);
                // VkApp.showRecommendGames("singleIcon_404", 10, null, 280, null);
            this.start_time = Laya.Browser.now(), this.node = this.owner, this.bg = this.node.getChildByName("bg"), this.btnAd = this.node.getChildByName("btnAd"), this.icon = this.node.getChildByName("icon"), this.btnClose = this.bg.getChildByName("btnClose"), this.icon.on(Laya.Event.CLICK, this, this.onBtnAd), this.btnAd.on(Laya.Event.CLICK, this, this.onBtnAd), this.btnClose.on(Laya.Event.CLICK, this, this.onBtnClose), this.initPosition(), this.initData(), this.initSwitch()
        }
        initData() {
            console.log("原生：", S.advertisement), this.node.visible = !1
        }
        initPosition() {
            1 == this.positionType && (this.node.y = a.height() - this.node.height)
        }
        initSwitch() {
            1 == this.switchType && (this.node.visible = !1), 2 == this.switchType && Laya.Browser.width / Laya.Browser.height >= .5 && this.onBtnClose()
        }
        refreshAd() {}
        stopRefresh() {}
        onBtnAd() {
            console.info("点击了")
        }
        onBtnClose() {
            console.info("点击了关闭"), this.node.visible = !1
        }
        onDisable() {
            console.info("关闭了广告"), this.node && Laya.Browser.now() - this.start_time > 500 && (this.node.removeSelf(), this.node.destroy())
        }
    }
    class Dt extends e.test.VictorySceneUI {
        constructor() {
            super(), this.addGold = 0, this.heel_num = 0, a.setScale(this),
             Zt.instance.screenAdaptation(this.root, 50), y.fashionItem || y.challengeItem || (this.root.y = this.root.y - 200),
              this.nativeAd.y = a.height() - this.nativeAd.height
        }
        onOpened(e) {
            S.normal_screen && Laya.timer.once(S.delay_screen_time, this, () => {
                U.mainCH.showInterstitialAd()
            }), this.heel_num = e, y.is_game_back = !0;
            let t = f.getGradeCyclic();
            console.info("当前关卡：", t);
            var i = bt.getDrama(t);
            console.info("鞋子数量：", this.heel_num), this.heel_num <= 5 ? this.addGold = i.v_gold * this.heel_num : 
            this.addGold = 6 * i.v_gold, this.lbGold.text = "+" + this.addGold, this.lbGoldVideo.text = "+" + 3 *
             this.addGold, console.info("当前关卡drama：", i), this.initData(), this.initBtn()
       console.log("胜利")
       if(!window.gameOver){
        window.GameOver=true
        VkApp.showNineBoxView(10, "золота", (num) => {//宝箱
            if(num>0){
             this.addGold+=num;
             this.lbGold.text = "+" + this.addGold
            }
        },()=>{
         VkApp.showRecommendGames("full_screen");// 结算关闭 显示全屏界面
        })
    Laya.timer.once(1500,this,()=>{
        //Taylor 插屏
        console.log("Sy --- 插屏");
        VkApp.showInterstitial(); //显示插屏
        window.GameOver=false
    })
         VkApp.showMoreGameBtn(); //新增全屏按钮
         VkApp.showShareBtn(); //分享按钮
 
         if (!window.end) {
            // VkApp.showBanner(); //显示底部banner矩阵
         }
         VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
         //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
         VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
             VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            //  VkApp.showRecommendGames("singleIcon_402", 10, null, 210, null);
            //  VkApp.showRecommendGames("singleIcon_404", 10, null, 280, null);
    //  });
       }
     
       window.gameStart=false
       window.showFree=false

VkApp.rankSync(t); //排行版数据上报 关卡数
if(!window.gameOver){

    }
    window.gameOver=true;
        }
        initBtn() {
            this.btnGetNormal.on(Laya.Event.CLICK, this, this.onBtnGetNormal), 
            this.btnGetVideo.on(Laya.Event.CLICK, this, this.onBtnGetVideo), 
            Zt.instance.delay(this.btnGetNormal)
           
        }
        initData() {
            if (this.ivItem.skin = "img/result/good.png", y.fashionItem && 
            y.fashionItem.ic && (this.ivItem.skin = "img/fashion/" + y.fashionItem.bg, Laya.Browser.width / Laya.Browser.height > .5)) {
                let e = this.nativeAd.getComponent(Mt);
                e && e.onBtnClose()
            }
            if (y.challengeItem && y.challengeItem.ic) {
                2 != d.getItemState(y.challengeItem.id).state &&
                 (this.addGold = y.challengeItem.tn, this.lbGold.text = "+" + this.addGold, this.lbGoldVideo.text = "+" + 3 * this.addGold);
                d.incItem(y.challengeItem);
                if (this.ivItem.skin = "img/challenge/" + y.challengeItem.bg, Laya.Browser.width / Laya.Browser.height > .5) {
                    let e = this.nativeAd.getComponent(Mt);
                    e && e.onBtnClose()
                }
            }
            y.fashionItem || y.challengeItem || f.addGrade()
            
        }
        onBtnGetNormal() {
            if( window.GameOver){
                return
        }
            console.info("普通领取"), H.instance.playSound(50014, 1), f.addGold(this.addGold), kt.instance.setGoldLabel(), f.saveData(), y.isShowAd = !0;
            let e = Jt.instance.getLockItem();
            S.showTyeShoes() && e ?(
            //  y.isChallengeItem || Zt.instance.openScene(Bt.SCENE_NAME, !1, e),
              y.fashionItem = null, y.challengeItem = null, Laya.Scene.close(Dt.SCENE_NAME), Zt.instance.reloadLevelMapAuto()) : (y.fashionItem = null, y.challengeItem = null, Laya.Scene.close(Dt.SCENE_NAME), Zt.instance.reloadLevelMapAuto())
        }
        onBtnGetVideo() {
            console.info("三倍领取"), H.instance.playSound(50014, 1), U.mainCH.showVideoAd(e => {
                if (e) {
                    f.addGold(3 * this.addGold), kt.instance.setGoldLabel(), f.saveData(), y.isShowAd = !0;
                    let e = Jt.instance.getLockItem();
                    S.showTyeShoes() && e ?(
                    //  y.isChallengeItem || Zt.instance.openScene(Bt.SCENE_NAME, !1, e), 
                    y.fashionItem = null, y.challengeItem = null, Laya.Scene.close(Dt.SCENE_NAME), Zt.instance.reloadLevelMapAuto()) :
                     (y.fashionItem = null, y.challengeItem = null, Laya.Scene.close(Dt.SCENE_NAME), Zt.instance.reloadLevelMapAuto())
                }
            })
        }
        onDisable() {
            window.gameOver=false
            window.gameStart=false
            window.showFree=false
            y.fashionItem = null, y.challengeItem = null
        }
    }
    Dt.SCENE_NAME = "test/VictoryScene.scene";
    class Pt {
        constructor(e, t) {
            this.list = null, this.page_num = 6, this.ListArrData = [], this.selectedItem = null, this.selectedPage = null, this.shopUI = e, this.list = t, this.init()
        }
        init() {
            this.list.hScrollBarSkin = "", this.list.selectEnable = !0, this.list.selectHandler = new Laya.Handler(this, this.onSelect), this.list.renderHandler = new Laya.Handler(this, this.onRender)
        }
        refreshPageList(e, t) {
            let i = d.getItemsConditionsByType(1, e);
            if (this.ListArrData = [], console.info("测试：", i), i.length > 0)
                for (let e = 0; e < i.length; e++) {
                    let s = i[e];
                    s.conditions[0].item.ct == t && this.ListArrData.push(s)
                }
            this.refreshListData()
        }
        refreshData(e, t) {
            let i = d.getItemsConditionsByType(1, e);
            if (this.ListArrData = [], i.length > 0)
                for (let e = 0; e < i.length; e++) {
                    let s = i[e];
                    s.conditions[0].item.ct == t && this.ListArrData.push(s)
                }
            this.list.refresh()
        }
        refreshListData() {
            this.list.dataSource = null;
            let e = this.ListArrData;
            if (e.length > 0) {
                let t, i = [],
                    s = -1;
                3 == e[0].conditions[0].item.ct && 2 != e[0].state && (s = 0);
                for (let a = 0; a < e.length; a++) {
                    let n = null,
                        r = !1,
                        o = !1;
                    e[a] && (n = e[a].conditions[0].item, r = 2 == e[a].state, 1 == n.sid && n.id == f.getPlayerSkin() && (o = !0, s = a), 2 == n.sid && n.id == f.getPlayerJewel() && (o = !0, s = a), 3 == n.sid && n.id == f.getPlayerGaogen() && (o = !0, s = a)), t = {
                        item: {
                            visible: r || 3 == n.ct,
                            skin: "img/skin/" + n.ic
                        },
                        lock: {
                            visible: !r && 3 != n.ct
                        },
                        lock1: {
                            visible: !r && 3 != n.ct
                        },
                        video: {
                            visible: !r && 3 == n.ct
                        },
                        light: {
                            visible: !1
                        }
                    }, i.push(t)
                }
                this.list.dataSource = i, -1 != s && (this.list.selectedIndex = s);
                let a = -1 == s ? 0 : s;
                this.ListArrData[a] && this.shopUI.onSelectData(this.ListArrData[a])
            }
            this.list.refresh()
        }
        onSelect(e) {
            if (-1 == e) return;
            let t = this.ListArrData[e];
            t && this.shopUI.onSelectData(t), 2 == t.state && (this.selectedItem && (this.selectedItem.light.visible = !1), this.list.selectedItem.light.visible = !0, this.selectedItem = this.list.selectedItem, 1 == t.conditions[0].item.sid && f.setPlayerSkin(t.conditions[0].item.id), 2 == t.conditions[0].item.sid && f.setPlayerJewel(t.conditions[0].item.id), 3 == t.conditions[0].item.sid && f.setPlayerGaogen(t.conditions[0].item.id), Jt.instance && Jt.instance.refreshGaogen(this, () => {
                Jt.instance.refreshRole(this, () => {})
            })), 3 == t.conditions[0].item.ct && (this.selectedItem && (this.selectedItem.light.visible = !1), this.list.selectedItem.light.visible = !0, this.selectedItem = this.list.selectedItem), this.list.selectedIndex = -1
        }
        onRender(e, t) {
            let i = e.getChildByName("video").getChildByName("video_num"),
                s = this.ListArrData[t].conditions[0];
            i.text = s.user_has + "/" + s.price
        }
    }
    class Nt {
        constructor() {
            Nt.instance = this, this.createHint()
        }
        showHint(e) {
            var t = this.addHint();
            t && (t.getChildByName("lb_hint").text = e, Laya.timer.once(1e3, this, () => {
                Laya.Tween.to(t, {
                    alpha: 0,
                    y: t.y - 250
                }, 1e3, null, Laya.Handler.create(this, () => {
                    t.removeSelf(), t.destroy()
                }))
            }))
        }
        createHint() {
            Laya.loader.create("prefab/hint.json", Laya.Handler.create(this, () => {}))
        }
        addHint() {
            var e = new Laya.Prefab;
            if (e.json = Laya.Loader.getRes("prefab/hint.json"), e.json) {
                var t = e.create();
                return t.zOrder = 99, a.setScale(t), t.x = (a.width() / 2 - t.width / 2) * a.getScaleRate(), t.y = (a.height() / 2 - t.height / 2) * a.getScaleRate(), Laya.stage.addChild(t), t
            }
        }
    }
    class Ot extends e.test.ShopUI {
        constructor() {
            super(), this.selectData = null, this.lastPlayerId = -1, this.lastChariotId = -1, this.shopType = 1, this.itemType = 1, this.goldPrize = 600, this.ischange = !0, this.rid = 0, this.gid = 0, this.jid = 0, a.setScale(this), this.root1.y = a.height() - this.root1.height, Zt.instance.screenAdaptation(this.root), Zt.instance.screenAdaptation(this.item, -50), Ot.instance = this, Jt.instance.store_scene3D || (Jt.instance.store_scene3D = bt.loadStoreScene3D(this.root1.y / a.height())), this.store_scene3D = Jt.instance.store_scene3D, this.hp_role_re = this.store_scene3D.getChildByName("hp_role_re"), this.hp_role = this.hp_role_re.getChildAt(0), this.hp_camera_body = this.store_scene3D.getChildByName("hp_camera_body"), this.hp_camera_neck = this.store_scene3D.getChildByName("hp_camera_neck"), this.hp_camera_shoes = this.store_scene3D.getChildByName("hp_camera_shoes"), this.store_camera = this.store_scene3D.getChildByName("camera"), this.store_camera_script = this.store_camera.getComponent(yt)
        }
        onOpened() {
            console.log("商店")
            VkApp.removeLoadingCircle();//删除loading
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();
            S.normal_screen && Laya.timer.once(S.delay_screen_time, this, () => {
                U.mainCH.showInterstitialAd()
            }), this.shopList = new Pt(this, this.list), this.show3DScene(), this.initData(), this.initBtn()
            this.btn_jewel.parent._children[1].y=100;
            this.btn_jewel.parent._children[2].y=100;
            this.btn_jewel.parent._children[3].y=210;
            this.btn_jewel.parent._children[4].y=210;
            this.btn_jewel.parent._children[5].y=320;
            this.btn_jewel.parent._children[6].y=320;
            this.btn_keai.parent._children[2].height=600
            this.btn_keai.parent._children[2].y=-50
                this._children[3].height=0
                this._children[3].width=0
        }
        show3DScene() {
            this.item.visible = !1, Jt.instance.scene3D_main.removeSelf(), this.addChild(this.store_scene3D), this.store_scene3D.zOrder = -1;
            let e = Jt.instance.mArmy.getRole(0, 0).getComponent(Lt);
            this.hp_role.transform.localRotationEulerZ = -2, e.goToStore(this.store_scene3D, this.hp_role), this.store_camera_script.goHpBody(this.hp_camera_body)
        }
        close3DScene() {
            this.store_scene3D.removeSelf(), Laya.stage.addChild(Jt.instance.scene3D_main), Jt.instance.roleGoToMap()
        }
        initBtn() {
            this.btnClose.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnClose]),
             this.btnGold.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnGold]), 
             this.btnAddGold.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnAddGold]),
              this.btnVideo.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnPurchase, [1]]), 
              this.btn_body1.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnBody, [1]]),
               this.btn_jewel1.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnJewel, [1]]),
                this.btn_gaogen1.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnGaogen, [1]]),
                 this.btn_keai.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnKeai]),
                  this.btn_mingxin.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnMingxin]),
             this.btn_nvwang.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnNvwang])
             this.btn_nvwang.visible=false
        }
        initData() {
            this.onBtnBody(1)
        }
        onBtnClose() {
            VkApp.showRandomInterAd();// 主界面 按钮关闭 随机插屏广告
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            // if (!window.end) {
            //     VkApp.showBanner(); //显示底部banner矩阵
            // }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 230, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 300, null);
            Jt.instance && Jt.instance.refreshGaogen(this, () => {
                Jt.instance.refreshRole(this, () => {
                    Jt.instance.refreshShowItem(), this.close3DScene(), this.close()
                })
            })
        }
        onBtnSure() {}
        onBtnBody(e) {
            this.shopType = 1, this.btn_jewel.visible = !1, this.btn_jewel1.visible = !0, this.btn_gaogen.visible = !1, this.btn_gaogen1.visible = !0, this.btn_body.visible = !0, this.btn_body1.visible = !1, this.onBtnKeai(), this.btn_mingxin.visible = !0, 
            this.btn_nvwang.visible = !1, this.store_camera_script && this.hp_camera_body && this.store_camera_script.goHpBody(this.hp_camera_body)
        }
        onBtnJewel(e) {
            this.shopType = 2, this.btn_body.visible = !1, this.btn_body1.visible = !0, this.btn_gaogen.visible = !1, this.btn_gaogen1.visible = !0, this.btn_jewel.visible = !0, this.btn_jewel1.visible = !1, this.onBtnKeai(), this.btn_mingxin.visible = !0, 
            this.btn_nvwang.visible = !1, this.store_camera_script && this.hp_camera_body && this.store_camera_script.goHpNeck(this.hp_camera_neck)
        }
        onBtnGaogen(e) {
            this.shopType = 3, this.btn_body.visible = !1, this.btn_body1.visible = !0, this.btn_jewel.visible = !1, this.btn_jewel1.visible = !0, this.btn_gaogen.visible = !0, this.btn_gaogen1.visible = !1, this.onBtnKeai(), this.btn_mingxin.visible = !0, 
            this.btn_nvwang.visible = !1, this.store_camera_script && this.hp_camera_body && this.store_camera_script.goHpShoes(this.hp_camera_shoes)
        }
        onBtnKeai() {
            this.itemType = 1, this.btn_keai.width = 178, this.btn_keai.height = 60, this.btn_mingxin.width = 170, this.btn_mingxin.height = 50, this.btn_nvwang.width = 170, this.btn_nvwang.height = 50, this.bbg.skin = "img/shop/bbg_1.png", this.shopList.refreshPageList(this.shopType, 1)
        }
        onBtnMingxin() {
            this.itemType = 2, this.btn_mingxin.width = 178, this.btn_mingxin.height = 60, this.btn_keai.width = 170, this.btn_keai.height = 50, this.btn_nvwang.width = 170, this.btn_nvwang.height = 50, this.bbg.skin = "img/shop/bbg_2.png", this.shopList.refreshPageList(this.shopType, 2)
        }
        onBtnNvwang() {
            this.itemType = 3, this.btn_nvwang.width = 178, this.btn_nvwang.height = 60, this.btn_mingxin.width = 170, this.btn_mingxin.height = 50, this.btn_keai.width = 170, this.btn_keai.height = 50, this.bbg.skin = "img/shop/bbg_3.png", this.shopList.refreshPageList(this.shopType, 3)
        }
        onSelectData(e) {
            this.selectData = e, this.refreshPrice(e)
        }
        refreshPrice(e) {
            e.conditions[0].item;
            this.btnGold.visible = !1, this.btnAddGold.visible = !1, this.btnVideo.visible = !1;
            let t = !1,
                i = this.shopList.ListArrData;
            for (let e = 0; e < i.length; e++) 2 != i[e].state && (this.goldPrize = i[e].conditions[0].price, t = !0);
            t && e.conditions[0].price_type_key.indexOf("video") <= -1 && (this.btnGold.visible = !0, this.btnAddGold.visible = !0), 
            this.gold_num.text = this.goldPrize + "", 2 != e.state && e.conditions[0].price_type_key.indexOf("video") > -1 &&
             (this.btnGold.visible = !1, this.btnAddGold.visible = !1, this.btnVideo.visible = !0, this.video_num.text = 
                "(" + e.conditions[0].user_has + "/" + e.conditions[0].price + ")")
        }
        setPriceType(e) {}
        onBtnPurchase(e) {
            let t = this.selectData.conditions[e];
            if (t || (t = this.selectData.conditions[0]), t) {
                this.selectData = h.itemAllConditions(t.item);
                let e = t.state,
                    i = t,
                    s = i.item,
                    a = i.price,
                    n = i.price_type_key,
                    r = n.split("_")[0];
                0 == e ? "gold_cur" == n ? a <= f.getGold() && this.purchaseSuccess(r) : 
                "video_chip" == n && U.mainCH.showVideoAd(e => {
                    if (e) {
                        this.refreshChip(s) ? this.purchaseSuccess(r) : (this.shopList.refreshData(this.shopType, this.itemType), this.refreshPrice(this.selectData))
                    }
                }) : 1 == e && this.purchaseSuccess(r)
            }
        }
        onBtnGold() {
            if (f.getGold() >= this.goldPrize) {
                let e = [];
                for (let t = 0; t < this.shopList.ListArrData.length; t++) 2 != this.shopList.ListArrData[t].state && e.push(this.shopList.ListArrData[t]);
                let t = e[_.getIntegerInRandom(e.length - 1, 0)];
                1 == t.conditions[0].item.sid && f.setPlayerSkin(t.conditions[0].item.id), 2 == t.conditions[0].item.sid && f.setPlayerJewel(t.conditions[0].item.id), 3 == t.conditions[0].item.sid && f.setPlayerGaogen(t.conditions[0].item.id), f.decGold(this.goldPrize), d.incItem(t.conditions[0].item), this.shopList.refreshPageList(this.shopType, this.itemType), kt.instance.setGoldLabel(), f.saveData()
            } else   VkApp.showToast(window.getLanguageByKey("Not_Enough_Diamonds"))  // Nt.instance.showHint("Недостаточно бриллиантов")
        }
        onBtnAddGold() {
            U.mainCH.showVideoAd(e => {
                e && (f.addGold(300), kt.instance.setGoldLabel())
            })
        }
        refreshChip(e) {
            d.incItemChip(e);
            this.selectData = h.itemAllConditions(e);
            let t = this.selectData.conditions[1];
            return t || (t = this.selectData.conditions[0]), t.price == t.user_has
        }
        purchaseSuccess(e) {
            var t = d.mergeItem(this.selectData, e);
            console.info("购买成功：", t), 1 == this.selectData.conditions[0].item.sid && f.setPlayerSkin(this.selectData.conditions[0].item.id), 2 == this.selectData.conditions[0].item.sid && f.setPlayerJewel(this.selectData.conditions[0].item.id), 3 == this.selectData.conditions[0].item.sid && f.setPlayerGaogen(this.selectData.conditions[0].item.id), f.saveData(), this.shopList.refreshPageList(this.shopType, this.itemType)
        }
        onDisable() {}
        onClosed() {
            Ot.instance = null
        }
    }
    Ot.SCENE_NAME = "test/Shop.scene";
    class Ut {
        constructor() {
            Ut.instance = this, this.createHint()
        }
        showHint(e, t = 1) {
            var i = this.addHint();
            if (i) {
                var s = i.getChildByName("icon"),
                    a = i.getChildByName("lb_num");
                s.skin = e, a.text = "x" + t, Laya.timer.once(1e3, this, () => {
                    Laya.Tween.to(i, {
                        alpha: 0,
                        y: i.y - 250
                    }, 1e3, null, Laya.Handler.create(this, () => {
                        i.removeSelf(), i.destroy()
                    }))
                })
            }
        }
        createHint() {
            Laya.loader.create("prefab/hintOther.json", Laya.Handler.create(this, () => {}))
        }
        addHint() {
            var e = new Laya.Prefab;
            if (e.json = Laya.Loader.getRes("prefab/hintOther.json"), e.json) {
                var t = e.create();
                return t.zOrder = 99, a.setScale(t), t.y = (a.height() / 2 - t.height / 2) * a.getScaleRate(), Laya.stage.addChild(t), t
            }
        }
    }
    class Vt {
        static initFunc() {
            let e = new Array;
            e.push(this.weapon1), e.push(this.armor1), e.push(this.cloak1), m.setFuncList(e)
        }
        static weapon1(...e) {
            let t = e[0];
            return Math.round(.0899 * t * t + 7.2018 * t - .1818)
        }
        static armor1(...e) {
            let t = e[0];
            return Math.round(1.0548 * t * t + 97.661 * t + .1399)
        }
        static cloak1(...e) {
            let t = e[0];
            return Math.round(.0942 * t * t + 8.8144 * t - .4773)
        }
    }
    class Ft extends e.test.LoadingUI {
        constructor() {
            super(), a.setScale(this), this.lb_bottom.y = a.height() - 100, new H, new Zt, new Nt, new Ut, Zt.instance.screenAdaptation(this.root), Zt.instance.screenAdaptation(this.pro_bg, 130), Zt.instance.screenAdaptation(this.progress_panel, 130)
        }
        onOpened() {
            console.log = function () {}, console.info = function () {}, new U(U.CH_H5), this.progress_panel.width = 1, Laya.timer.loop(1, this, this.freshProgress, [!1]), p.load(() => {
                Vt.initFunc(), H.instance.creatByJson(Laya.Handler.create(this, () => {
                    bt.init(), f.checkIsNewDay() && (f.setTicket(1), this.initFashion(), y.new_day = !0), f.setLoginTime(), f.saveData(), H.instance.loadSubPack(H.SUB_ID_HOME, () => {
                        H.instance.loadSubPack(H.SUB_ID_SOUNDS, () => {}), H.instance.loadSubPack(H.SUB_ID_OTHER, () => {
                            H.instance.loadSubPack(H.SUB_ID_MAP_1, () => {
                                H.instance.loadSubPack(H.SUB_ID_MAP_2, () => {
                                    H.instance.loadSubPack(H.SUB_ID_MAP_3, () => {
                                        H.instance.loadSubPack(H.SUB_ID_MAP_4, () => {
                                            bt.preLoadPropRes(Laya.Handler.create(this, () => {
                                                Laya.timer.clearAll(this), this.freshProgress(!0), console.info(this.progress_panel.width), Zt.instance.openScene(Jt.SCENE_NAME, !1), new kt
                                            }))
                                        })
                                    })
                                })
                            })
                        })
                    })
                }))
            })
        }
        startProgress() {
            this.progress_panel.width = 1, Laya.timer.loop(1, this, () => {
                this.freshProgress(!1)
            })
        }
        freshProgress(e = !1) {
            if (this.progress_panel.width < 403 && !e) {
                this.progress_panel.width += 1e3 / 60 * 403 / 2e3;
                var t = Math.round(100 * this.progress_panel.width / 403);
                this.progress_label.text = t + "%"
            } else this.progress_panel.width = 403, this.progress_label.text = "100%"
        }
        initFashion() {
            let e = d.getItemsConditionsByType(1, 4);
            for (let t = 0; t < e.length; t++) {
                let i = e[t].conditions[0].item;
                d.setUserYn(i, 0)
            }
        }
    }
    Ft.SCENE_NAME = "test/Loading.scene";
    class Ht extends e.test.TrySkinUI {
        constructor() {
            super(), this.isWin = !1, this.multiple = 0, this.itemData = null, a.setScale(this), a.height() < 1300 ? this.top_banner.y = .5 * a.height() - 300 :
             this.top_banner.y = .5 * a.height() - 443 - 50, this.bottom_banner.y = .5 * a.height() + 187, Jt.instance.shoes_try_scene3D || 
             (Jt.instance.shoes_try_scene3D = bt.loadShoesTryScene3D((this.bottom_banner.y + 260) / a.height())), this.scene3D = Jt.instance.shoes_try_scene3D, 
             this.hp_role_re = this.scene3D.getChildByName("hp_role_re"), this.hp_role = this.hp_role_re.getChildAt(0), 
             this.hp_camera_shoes = this.scene3D.getChildByName("hp_camera_shoes"), this.camera = this.scene3D.getChildByName("camera"), 
             this.role = this.hp_role.getChildAt(0)
        }
        onOpened(e) {
            console.log("试用")
            VkApp.removeLoadingCircle();//删除loading
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
                // VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮 
            Laya.timer.once(S.delay_screen_time, this, () => {
                U.mainCH.showInterstitialAd()
            }), this.isWin = e.isWin, this.multiple = e.multiple, Ht.instance = this, this.initData(), this.show3DScene(), this.initBtn()
            this.btnCancel.scaleX=2
            this.btnCancel.scaleY=2
            this.btnCancel.x=260
            this.btnGetVideo.centerY=280
            this.btnCancel.centerY=380
        }
        show3DScene() {
            this.item.visible = !1, this.addChild(this.scene3D), this.scene3D.zOrder = -1, this.role.getComponent(Lt).wear(bt.Reward_Shoes, this.itemData.ae)
        }
        close3DScene() {
            this.scene3D.removeSelf()
        }
        initBtn() {
            this.btnCancel.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnCancel]), this.btnGetVideo.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnGetVideo]), Zt.instance.delay(this.btnCancel)
        }
        initData() {
            this.multiple >= 0 ? this.itemData = y.tryShoes : this.itemData = y.showShoes
        }
        onBtnGetVideo() {
            U.mainCH.showVideoAd(e => {
                e && (d.incItem(this.itemData), 3 == this.itemData.sid && f.setPlayerGaogen(this.itemData.id), this.onBtnCancel())
            })
        }
        onBtnCancel() {
            VkApp.showRandomInterAd();// 主界面 按钮关闭 随机插屏广告
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
              //  VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮

     VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 210, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 280, null);
            console.info("点击关闭"), this.multiple >= 0 ? (this.closeSelf(), this.close()) : Jt.instance && Jt.instance.refreshGaogen(this, () => {
                Jt.instance.refreshShowItem(),
                 this.close3DScene(), 
                 this.close()
            })
        }
        closeSelf() {
            this.close3DScene(), this.isWin ? Zt.instance.openScene(Dt.SCENE_NAME, !1, this.multiple) : Zt.instance.openScene(Rt.SCENE_NAME, !1)
        }
        onDisable() {}
        onClosed() {
            Ht.instance = null
        }
    }
    Ht.SCENE_NAME = "test/TrySkin.scene", Ht.instance = null;
    class Gt extends e.test.TurntableUI {
        constructor() {
            super(), this.resultIndex = 1, this.mulList = [1, 50, 1, 100, 1, 150], this.imgList = ["img/turnable/zs1.png", "img/turnable/zs1.png", "img/turnable/zs1.png", "img/turnable/zs2.png", "img/turnable/zs2.png", "img/turnable/zs3.png"], this.rewardGun = null, this.rewardSkin = null, this.rewardShoes = null, this.is_turn = !1, this.is_Item = !1, this.maxtime = 3600, this.giveTicket = 0, a.setScale(this), Zt.instance.screenAdaptation(this.root)
        }
        onOpened(e) {
            U.mainCH.hideBannerAd(), this.source_scene = e, this.setRewardSkin(), this.init2DUI(), this.refreshData()
        }
        init2DUI() {
            this.btnStart.on(Laya.Event.CLICK, this, this.onBtnStart), 
            this.btnStart1.on(Laya.Event.CLICK, this, this.onBtnStart), 
            this.btnClose.on(Laya.Event.CLICK, this, this.onBtnClose), 
            Laya.timer.loop(1, this, () => {
                this.update()
            })
        }
        refreshData() {
            this.lbHint.text = 3 - f.getTicket() + "", 3 - f.getTicket() == 0 ? this.lbHint.visible = !1 : this.lbHint.visible = !0
        }
        update() {
            this.is_turn && this.checkPointerAngel()
        }
        onBtnStart() {
            this.is_turn || U.mainCH.showVideoAd(e => {
                e && (f.addTicket(), this.is_turn = !0, this.startTable(), this.refreshData())
            })
        }
        onBtnGetTicket() {
            U.mainCH.showVideoAd(e => {
                e && (f.addTicket(), f.addTicket(), this.refreshData())
            })
        }
        onBtnGetAward(e) {
            d.incItem(e), p.add("skin", 1), f.saveData()
        }
        onBtnClose() {
            Laya.timer.clearAll(this), this.btnClose.offAll(Laya.Event.CLICK), this.btnStart.offAll(Laya.Event.CLICK), this.btnStart1.offAll(Laya.Event.CLICK), this.close()
        }
        showSkin(e) {
            var t = this.table.getChildAt(e).getChildByName("ivAward"),
                i = this.table.getChildAt(e).getChildByName("lbAward");
            t.skin = this.imgList[e], i.text = "x" + this.mulList[e]
        }
        resetTable() {
            this.table.rotation = 0
        }
        startTable() {
            this.resetTable(), this.btnClose.disabled = !0;
            let e = 100 * Math.random();
            if (console.log("num:", e), e < 50 && f.getTicket() >= 3) this.resultIndex = 2;
            else if (e > 50 && f.getTicket() >= 3) this.resultIndex = 5;
            else {
                this.resultIndex = [0, 1, 3, 4][_.getIntegerInRandom(0, 3)]
            }
            let t = 1e3 * (4 * Math.random() + 4),
                i = 5 + ~~(5 * Math.random()),
                s = 60 * this.resultIndex + _.getRealInRandom(-25, 25);
            this.rotateTable(s + 360 * i, t), console.log("angle:", s)
        }
        rotateTable(e, t) {
            Laya.Tween.to(this.table, {
                rotation: e
            }, t, Laya.Ease.cubicOut, Laya.Handler.create(this, this.showResult))
        }
        showResult() {
            if (this.is_turn = !1, console.info("抽奖结果:", this.resultIndex, this.mulList[this.resultIndex]), 1 == this.mulList[this.resultIndex]) f.setTicket(0), this.refreshData(), this.is_Item = !0, this.btnClose.disabled = !1, this.resultIndex, this.resultIndex, this.setRewardSkin();
            else {
                var e = this.mulList[this.resultIndex];
                f.addGold(1 * e), kt.instance.setGoldLabel()
            }
        }
        checkPointerAngel() {
            let e = ~~Math.abs(this.table.rotation) % 360,
                t = 0;
            if (e >= 328 || e <= 28) t = 0;
            else if (e > 28 && e <= 88) t = 1;
            else if (e > 88 && e <= 148) t = 2;
            else if (e > 148 && e <= 208) t = 3;
            else if (e > 208 && e <= 268) t = 4;
            else {
                if (!(e > 268 && e <= 328)) return;
                t = 5
            }
            if (this.lastIndex == t) return;
            let i = this.table.getChildAt(t);
            if (this.setItemData(i, 1), null != this.lastIndex && null != this.lastIndex) {
                let e = this.table.getChildAt(this.lastIndex);
                this.setItemData(e, 0)
            }
            this.lastIndex = t
        }
        setItemData(e, t) {
            let i = e.getChildByName("light");
            i.visible = !!t
        }
        setRewardSkin() {
            let e = null,
                t = d.getItemsConditionsByType(1, 1).filter(e => 2 != e.state),
                i = d.getItemsConditionsByType(1, 2).filter(e => 2 != e.state),
                s = d.getItemsConditionsByType(1, 3).filter(e => 2 != e.state);
            if (t.length <= 0) this.rewardGun = null, this.mulList[2] = 150, this.imgList[2] = "img/turnable/zs2.png";
            else {
                let i = Math.floor(Math.random() * t.length);
                this.mulList[2] = 1, e = t[i].conditions[0].item, this.rewardGun = e, this.imgList[2] = "img/skin/" + e.ic
            }
            if (i.length <= 0) this.rewardSkin = null, this.mulList[4] = 200, this.imgList[4] = "img/turnable/zs3.png";
            else {
                let t = Math.floor(Math.random() * i.length);
                this.mulList[4] = 1, e = i[t].conditions[0].item, this.rewardSkin = e, this.imgList[4] = "img/skin/" + e.ic
            }
            if (s.length <= 0) this.rewardShoes = null, this.mulList[0] = 200, this.imgList[0] = "img/turn/gold4.png";
            else {
                let t = Math.floor(Math.random() * s.length);
                this.mulList[0] = 1, e = s[t].conditions[0].item, this.rewardShoes = e, this.imgList[0] = "img/skin/" + e.ic
            }
            for (var a = 0; a < 6; a++) this.showSkin(a)
        }
    }
    Gt.SCENE_NAME = "test/Turntable.scene";
    class Kt extends e.test.FreeSkinUI {
        constructor() {
            super(), this.isWin = !1, this.multiple = 0, this.itemData = null, a.setScale(this), 
            Zt.instance.screenAdaptation(this.root), Kt.instance = this, this.nativeAd.y = a.height() - this.nativeAd.height
        }
        onOpened(e) {
            console.log("免费试用")
            // window.showFree=true
            VkApp.removeLoadingCircle();//删除loading
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();
            this.onBtnCancel();
            // VkApp.showMoreGameBtn(); //新增全屏按钮
            // VkApp.showShareBtn(); //分享按钮

            // if (!window.end) {
            //  //   VkApp.showBanner(); //显示底部banner矩阵
            // }
            // VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            // //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮 
            // S.normal_screen && Laya.timer.once(S.delay_screen_time, this, () => {
            //     U.mainCH.showInterstitialAd()
            // }), this.itemData = e, this.initData(), this.initBtn()
            
        }
        initBtn() {
            this.btnCancel.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnCancel]), 
            this.btnGetVideo.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnGetVideo]), Zt.instance.delay(this.btnCancel)
        }
        initData() {
            this.ivItem.skin = "img/skin/" + this.itemData.ic
        }
        onBtnGetVideo() {
            U.mainCH.showVideoAd(e => {
                e && (this.closeBtn(),
                 Jt.instance.freeTry(this.itemData, this, () => {
                    this.onBtnCancel()
                }))
            })
        }
        onBtnCancel() {
            console.info("点击关闭"), this.closeSelf(), this.close()
        }
        closeSelf() {
            setInterval(this.startGame,500)
        }
        startGame(){
            if(!window.isVideo){
                Jt.instance.changeStart()
                clearInterval(this.startGame)
            }
        }
        closeBtn() {
            this.btnCancel.offAll(), this.btnGetVideo.offAll()
        }
        onDisable() {}
        onClosed() {
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();
            Kt.instance = null
        }
    }
    Kt.SCENE_NAME = "test/FreeSkin.scene", Kt.instance = null;
    class zt {
        constructor() {
            zt.instance = this
        }
        Enter(e) {
            console.log("FSMGameRunning")
        }
        Execute(e) {}
        Exit(e) {}
    }
    new zt;
    class Yt {
        constructor() {
            Yt.instance = this
        }
        Enter(e) {
            console.log("FSMGameStop")
        }
        Execute(e) {}
        Exit(e) {}
    }
    new Yt;
    class Wt {
        constructor() {
            Wt.instance = this
        }
        Enter(e) {
            console.log("FSMGameReady")
        }
        Execute(e) {}
        Exit(e) {}
    }
    new Wt;
    class qt {
        constructor() {
            qt.instance = this
        }
        Enter(e) {
            console.log("FSMGamePreStart")
        }
        Execute(e) {}
        Exit(e) {}
    }
    new qt;
    class jt extends e.test.FashionUI {
        constructor() {
            super(), this.listData = [], this.selectindex = 0, a.setScale(this), Zt.instance.screenAdaptation(this.root), jt.instance = this
        }
        onOpened() {
            console.log("时装秀")
            VkApp.removeLoadingCircle();//删除loading
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
                // VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            this.initData(), this.initBtn()
        }
        initBtn() {
            this.btnCancel.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnCancel]), 
            this.btnLeft.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnLeft]), 
            this.btnRight.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnRight]), 
            this.btnSure.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnSure]), 
            this.btnUse.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnUse])
        }
        initData() {
            this.listData = d.getItemsConditionsByType(1, 4), this.onBtnLeft()
        }
        onBtnLeft() {
            this.selectindex--, this.selectindex < 0 && (this.selectindex = 0), 0 == this.selectindex &&
             (this.btnLeft.disabled = !0, this.btnLeft.gray = !1, this.btnLeft.skin = "img/fashion/fa_4.png"), this.btnRight.disabled = !1, 
             this.btnRight.skin = "img/fashion/fa_5.png", this.refreshData()
        }
        onBtnRight() {
            this.selectindex++, this.selectindex > this.listData.length - 1 && (this.selectindex = this.listData.length - 1), 
            this.selectindex == this.listData.length - 1 && (this.btnRight.disabled = !0, this.btnRight.gray = !1, this.btnRight.skin = "img/fashion/fa_4.png"), 
            this.btnLeft.disabled = !1, this.btnLeft.skin = "img/fashion/fa_5.png", this.refreshData()
        }
        onBtnCancel() {
            VkApp.showRandomInterAd();// 主界面 按钮关闭 随机插屏广告
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
               // VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 230, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 300, null);
            this.close()
        }
        onBtnSure() {
            U.mainCH.showVideoAd(e => {
                e && (d.incItem(this.listData[this.selectindex].conditions[0].item), this.onBtnUse())
            })
        }
        onBtnUse() {
            let e = this.listData[this.selectindex].conditions[0].item;
            d.setUserYn(e, 1)
            Jt.instance.intoFashion(e), this.close()
            VkApp.showRandomInterAd();// 主界面 按钮关闭 随机插屏广告
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
              //  VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 230, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 300, null);
        }
        refreshData() {
            let e = this.listData[this.selectindex],
                t = this.listData[this.selectindex].conditions[0].item;
            this.ivItem.skin = "img/fashion/" + t.ic;
            let i = d.getUserBoxItem(t);
            this.lbName.font="Arial"
            this.lbName.fontSize=20;
            this.lbName.text = t.ae, 2 == e.state || 1 == t.ct && !i.yn ? (this.btnUse.visible = !0, this.btnSure.visible = !1) :
             (this.btnSure.visible = !0, this.btnUse.visible = !1)
        }
        onDisable() {}
        onClosed() {
            jt.instance = null
        }
    }
    jt.SCENE_NAME = "test/Fashion.scene";
    class Xt extends Laya.Script3D {
        constructor() {
            super(), this.aniName = "", this.aniSpeed = 1, this.run_timer = 1e3, this.isrun = !1, this.pre_anim_normalized_time = 0, this.last_normalized = 0
        }
        onEnable() {
            super.onEnable(), this.role = this.owner, this.ani = this.role.getComponent(Laya.Animator), this.playIdle()
        }
        onUpdate() {
            super.onUpdate()
        }
        playIdle() {
            this.playAnim("sit")
        }
        playWin() {
            let e = _.getIntegerInRandom(2, 1);
            this.playAnim("win" + e)
        }
        playAnim(e, t = 0, i = 0) {
            this.ani && e != this.aniName && (this.aniName = e, 0 == t ? this.ani.play(this.aniName, 0, i) : this.ani.crossFade(this.aniName, t, 0, i))
        }
        getAnimStartNormalizedTime() {
            var e = this.ani.getCurrentAnimatorPlayState().normalizedTime;
            return this.last_normalized, this.last_normalized = e, e - this.pre_anim_normalized_time >= 0 ? e - this.pre_anim_normalized_time : (this.pre_anim_normalized_time = e + 1, e)
        }
    }
    class Jt extends e.test.GameSceneUI {
        constructor() {
            super(), this.isPlaying = !1, this.is_skin_recommend_enable = !0, this.freeItem = null, this.walk_line_lowest_y = 99990, this.way_role = new Array, this.win_role = new Array, Jt.instance = this, this.mFSM = new b(this), this.mFSM.SetCurrentState(Yt.instance), a.setScale(this), Zt.instance.screenAdaptation(this.btnSetting), Zt.instance.screenAdaptation(this.root), Zt.instance.screenAdaptation(this.ivGrade, -100), Zt.instance.screenAdaptation(this.btnSkin, 150), this.ivGrade.visible = !1, this.mArmy = new vt, this.setEventBus(), this.initPhysicsEngine(), this.effect_friction_left = Laya.loader.getRes(H.instance.getCompleteResByID(6001)), this.effect_friction_right = Laya.ShuriKenParticle3D.instantiate(this.effect_friction_left), this.effect_win = Laya.loader.getRes(H.instance.getCompleteResByID(6002))
        }
        onOpened() {
            this.btnSetting.visible = !1, this.level_pro.visible = !1,
                this.btnShop.visible = !1, this.btnFashion.visible = !1, this.btnChallenge.visible = !1,
                this.btnSkin.visible = !1, this.btnTurn.visible = !1, this.sp_guide.visible = !1, this.btnShortcut.visible = !1,
                kt.instance.hideGoldBanner(), this.reloadMapAuto(), y.is_game_back = !1
                this.btnTurn.y=600;
                this.btnShop.y=600;
                this.btnFashion.y=500;
                this.btnChallenge.y=400;
                this.sp_guide.y=700
            console.log("主界面")
            if (VkApp.isSoundMute) {
                CoinAppAudio.stopAll();
            } else {
                CoinAppAudio.playMusic(CoinAppAudio.bgm);
            }
            window.gameOver=false
            window.gameStart=false
            VkApp.removeLoadingCircle(); //删除loading
            if (!window.first) {
                VkApp.initShareBtn(() => {
                    window.shareGame();
                }, null, null, 10, 130); //新增分享按钮 
                VkApp.initMoreGameBtn(null, 10, null, 190); //新增全屏按钮
                window.first = true
                // VkApp.showRankView(); //显示排行榜界面
               Laya.timer.once(1000,this,()=>{
                VkApp.yandexReady();
               })
            }
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
                //VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 230, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 300, null);
        }
        reloadMapAuto() {
            console.info("是否显示九宫格", y.isShowAd), console.info("九宫格广告开关：", S.show_game_portalAd);
            let e = f.getGradeCyclic();
            console.info("当前关卡：", e);
            var t = bt.getDrama(e);
            let i = t.res_id;
            this.lbGrade.font="Arial"
            console.info("场景值：", i), this.lbGrade.text = window.getLanguageByKey("LV") + ":" + f.getGrade(), t.name && (this.lbGrade.text = t.name), console.info("时装周：", y.fashionItem), y.fashionItem && (y.fashionItem.ml && (i = y.fashionItem.ml), y.fashionItem.ae && (this.lbGrade.text = y.fashionItem.ae)), y.challengeItem && (y.challengeItem.ml && (i = y.challengeItem.ml), y.challengeItem.ae && (this.lbGrade.text = y.challengeItem.ae)), this.loadLevelMap(i), this.initLevel(),
             H.instance.stopSound(50003), H.instance.stopMusic(), H.instance.playMusic(50020)
        }
        hasShortcutInstalled() {}
        onBtnShortcut() {}
        refreshShowItem() {
            let e = d.getItemsConditionsByType(1, 3).filter(e => 2 != e.state);
            if (e.length > 0) {
                let t = e[Math.floor(Math.random() * e.length)].conditions[0].item;
                console.info("首页鞋子：", t), this.ivItem.skin = "img/skin/" + t.ic, y.showShoes = t
            } else this.btnSkin.visible = !1
        }
        getLockItem() {
            let e = d.getItemsConditionsByType(1, 1),
                t = d.getItemsConditionsByType(1, 2);
            var i = [];
            if (e.length > 0)
                for (let t = 0; t < e.length; t++) {
                    let s = e[t];
                    s.conditions[0].item;
                    2 != s.state && i.push(s)
                }
            if (t.length > 0)
                for (let e = 0; e < t.length; e++) {
                    let s = t[e];
                    s.conditions[0].item;
                    2 != s.state && i.push(s)
                }
            var s = null;
            return i.length > 0 && (s = i[_.getIntegerInRandom(i.length - 1, 0)].conditions[0].item), s
        }
        loadLevelMap(e = 30001) {
            VkApp.removeLoadingCircle();//删除loading
            let t = d.getItemByID(f.getPlayerGaogen()).ae,
                i = bt.Reward_Shoes;
            y.tryShoes = this.showSkin();
            let s = y.tryShoes.ae;
            this.cleanMap(), this.loading.visible = !0, bt.loadLevelScene(e, t, i, s, Laya.Handler.create(this, (e, i, a) => {
                if (i.name.indexOf("_AtakanLevel_Fashion") > -1 && i) {
                    for (let e = 0; e < i.numChildren; e++) {
                        var n = i.getChildAt(e);
                        if (n.name.indexOf("map_FashionWeek") > -1) break;
                        n = null
                    }
                    let e = n.getChildByName("hp_Audience");
                    for (let t = 0; t < e.numChildren; t++) {
                        let i = e.getChildAt(t),
                            s = _.getIntegerInRandom(10, 7),
                            a = K.getSP(2e3 + s);
                        i.addChild(a), a.transform.localPosition = new Laya.Vector3(0, 0, 0), a.transform.localRotationEuler = new Laya.Vector3(0, 0, 0), a.addComponent(Xt), this.way_role.push(a)
                    }
                }
                this.loading.visible = !1, y.is_game_back && y.isChallengeItem && this.onBtnChallenge(), y.is_game_back = !1, this.hasShortcutInstalled(), kt.instance.showGoldBanner(),
                 this.btnSetting.visible = !0, this.level_pro.visible = !0, this.btnShop.visible = !1, this.btnFashion.visible = !0,
                  this.btnChallenge.visible = !0, this.btnSkin.visible = !1, this.btnTurn.visible = !0, 
                 this.sp_guide.visible = !0, y.is_win = !1;
                let r = this.nativeAd.getComponent(Mt);
                r && r.stopRefresh(), this.refreshShowItem(), this.ani1.play(), this.level_pro.visible = !0, this.ivGrade.visible = !1, this.scene3D_main = e, this.map_main = i, this.camera_main = a, this.camera_script = a.getComponent(Ct), this.addEve();
                let o = _t.mapinit(e, this.map_main.name);
                if (this.hp_player_birth = o.hp_player_birth, this.obstacle_list = o.obstacle_list, _t.find(this.map_main, "walk_line", !1).forEach(e => {
                        let t = e.transform.rotationEuler.x,
                            i = e.transform.position.y;
                        t > 3 && (i -= Math.asin(C.degToRad(t)) * e.transform.getWorldLossyScale().z * .01), this.walk_line_lowest_y > i && (this.walk_line_lowest_y = i)
                    }), _t.refreshCollectables(this.map_main, t, 0, bt.Reward_Shoes, s), this.mArmy.getRole(0, 0)) this.roleGoToMap();
                else {
                    let e = d.getItemByID(f.getPlayerSkin());
                    this.addRole(e.ml)
                }
                let l = d.getItemByID(f.getPlayerJewel()).ae,
                    h = this.mArmy.getRole(0, 0).getComponent(At);
                h.wear(bt.Reward_Shoes, t), h.wear(bt.Reward_Jewelry, l), this.refreshGaogen(this, () => {
                    this.refreshRole(this, () => {})
                }), this.initJsui(), Laya.timer.once(500, this, () => {
                    this.mFSM.ChangeState(Wt.instance)
                }), Laya.Scene.destroy(Ft.SCENE_NAME)
            }))
        }
        initJsui() {
            if (this.freeItem = this.getLockItem(), !this.jsui) {
                let e = this.mArmy.getRole(0, 0).getComponent(At);
                this.jsui = new Tt(this.jsUI, this, () => {
                    if (S.showStartSkin() && this.freeItem || this.changeStart(), this.mFSM.isInState(zt.instance)) {
                        e.move_ctrl.setX(e.role.transform.position.x),this.sp_guide.visible = !1,
                        this.ani1.stop(), this.level_pro.visible = !1, this.ivGrade.visible = !0, this.btnShortcut.visible = !1;
                        if(! window.gameStart){
                            window.gameStart=true
                            VkApp.showInterAdAndCallBack(()=>{
                                this.roleGo()
                            }); 
                        }
                        for (let e = 0; e < this.way_role.length; e++) {
                            this.way_role[e].getComponent(Xt).playWin()
                        }
                    }
                }, () => {}, (t, i) => {
                    this.mFSM.isInState(zt.instance) && e.ctrlMoveX(t)
                }, 1, 1), this.buttonInit(), this.jsUI.on(Laya.Event.CLICK, this, () => {
                    S.showStartSkin() && this.freeItem && this.mFSM.isInState(Wt.instance) && (this.btnShop.visible = !1, this.btnFashion.visible = !1, 
                        this.btnChallenge.visible = !1, this.btnSkin.visible = !1, this.btnTurn.visible = !1,
                         this.btnSetting.visible = !1,!window.showFree 
                         && (VkApp.addLoadingCircle(),Zt.instance.openScene(Kt.SCENE_NAME, !1, this.freeItem)))
                })
            }
        }
        changeStart() {
            // if (this.mFSM.isInState(Wt.instance)) {
                H.instance.playMusic(50001), this.btnShop.visible = !1, this.btnFashion.visible = !1, 
                this.btnChallenge.visible = !1, this.btnSkin.visible = !1, this.btnTurn.visible = !1,
                 this.btnSetting.visible = !1;
                let e = this.nativeAd.getComponent(Mt);
                e && e.refreshAd(), this.mFSM.ChangeState(zt.instance)
            // }
        }
        roleGo() {
            let e = this.mArmy.getRole(0, 0).getComponent(At);
            e.mFSMLeg.isInState(Z.instance) && (e.mFSMLeg.ChangeState(Q.instance), this.camera_script.setAimObjectAndRun(e.role))
        }
        roleGoToMap() {
            let e = this.mArmy.getRole(0, 0);
            this.scene3D_main.addChild(e), e.transform.rotationEuler = new Laya.Vector3(0, 0, 0);
            let t = e.getComponent(At);
            t.reset(this.hp_player_birth.transform.position, this.map_main.getChildByName("Segments")), t.wear(bt.Reward_Shoes, t.wear_shoes_name), t.body.enabled = !0
        }
        addEve() {
            if (3 == this.map_main.numChildren) {
                let e = Laya.loader.getRes(H.instance.getCompleteResByID(20001));
                this.scene3D_main.addChild(e)
            }
            this.hp_effect_win_point_list = _t.setFinish(this.map_main)
        }
        playWinEffect() {
            if (this.hp_effect_win_point_list) {
                this.scene3D_main.addChild(this.effect_win), this.effect_win.transform.position = this.hp_effect_win_point_list[0].clone(), this.playEffect(this.effect_win);
                for (let e = 0; e < 3; e++) Laya.timer.once(2e3 * (e + 1), this, () => {
                    this.effect_win.parent && 4 == this.hp_effect_win_point_list.length && (this.effect_win.transform.position = this.hp_effect_win_point_list[e + 1].clone(), this.playEffect(this.effect_win))
                })
            }
        }
        playEffect(e) {
            e.particleSystem.stop(), e.particleSystem.play();
            for (let t = 0; t < e.numChildren; t++) {
                let i = e.getChildAt(t);
                i.particleSystem.stop(), i.particleSystem.play()
            }
        }
        setLabelInfo() {
            let e = 0,
                t = this.mArmy.getTeamByID(0).role_list;
            for (let i = 0; i < t.length; i++) {
                t[i].getComponent(Lt).hp_cur > 0 && e++
            }
            let i = 0,
                s = this.mArmy.getTeamByID(1).role_list;
            for (let e = 0; e < s.length; e++) {
                s[e].getComponent(Lt).hp_cur > 0 && i++
            }
            this.lb_info.text = "搜寻者生存：" + e + "  伪装者生存：" + i
        }
        setEventBus() {
            this.func_roleAtkExeEvent = this.roleAtkExeEvent.bind(this), X.AddListener(i.ATK_EXE, this.func_roleAtkExeEvent), this.func_roleBehurtExeEvent = this.roleBehurtExeEvent.bind(this), X.AddListener(i.BEHURT_EXE, this.func_roleBehurtExeEvent), this.func_roleSkillExeEvent = this.roleSkillExeEvent.bind(this), X.AddListener(i.SKILL_EXE, this.func_roleSkillExeEvent), this.func_roleFsmEnterEvent = this.roleFsmEnterEvent.bind(this), X.AddListener(i.FSM_ENTER, this.func_roleFsmEnterEvent), this.func_roleGetDem = this.roleGetDem.bind(this), X.AddListener(i.DEM, this.func_roleGetDem), this.func_roleWinEvent = this.roleWinEvent.bind(this), X.AddListener(i.WIN, this.func_roleWinEvent), this.func_roleFailtEvent = this.roleFailtEvent.bind(this), X.AddListener(i.FAILT, this.func_roleFailtEvent), this.func_roleAnimWalkHitEvent = this.roleAnimWalkHit.bind(this), X.AddListener(i.ANIM_WALK_HIT, this.func_roleAnimWalkHitEvent), this.func_roleAnimClapEvent = this.roleAnimClap.bind(this), X.AddListener(i.ANIM_CLAP, this.func_roleAnimClapEvent), this.setEvent("func_roleChangeShoesEvent", this.roleChangeShoes, i.CHANGE_SHOES)
        }
        setEvent(e, t, i) {
            this[e] = t.bind(this), X.AddListener(i, this[e])
        }
        removeEventBus() {
            X.RemoveListener(i.ATK_EXE, this.func_roleAtkExeEvent), X.RemoveListener(i.BEHURT_EXE, this.func_roleBehurtExeEvent), X.RemoveListener(i.SKILL_EXE, this.func_roleSkillExeEvent), X.RemoveListener(i.FSM_ENTER, this.func_roleFsmEnterEvent), X.RemoveListener(i.DEM, this.func_roleGetDem), X.RemoveListener(i.WIN, this.func_roleWinEvent), X.RemoveListener(i.FAILT, this.func_roleFailtEvent), X.RemoveListener(i.ANIM_WALK_HIT, this.func_roleAnimWalkHitEvent), X.RemoveListener(i.ANIM_CLAP, this.func_roleAnimClapEvent), X.RemoveListener(i.CHANGE_SHOES, this.func_roleChangeShoesEvent)
        }
        buttonInit() {
            this.btnSetting.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnSetting]), 
            this.btnShop.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnShop]), this.btnFashion.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnFashion]), this.btnShortcut.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnShortcut]), this.btnTurn.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnTurn]),
             this.btnSkin.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnSkin]), this.btnChallenge.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnChallenge])
             this.btnChallenge.visible=false
            }
        onBtnSkin() {
            VkApp.addLoadingCircle();  //添加loading
            Zt.instance.openScene(Ht.SCENE_NAME, !1, {
                isWin: !1,
                multiple: -1
            })
        }
        onBtnChallenge() {
            Zt.instance.openScene(Qt.SCENE_NAME, !1)
        }
        showSkin() {
            let e = d.getItemsConditionsByType(1, 3);
            var t = [];
            if (e.length > 0)
                for (let i = 0; i < e.length; i++) {
                    let s = e[i];
                    s.conditions[0].item;
                    2 != s.state && t.push(s)
                }
            return t.length < 1 && (t = e), t[_.getIntegerInRandom(t.length - 1, 0)].conditions[0].item
        }
        refreshRole(e, t, i = 0) {
            i || (i = f.getPlayerSkin());
            let s = d.getItemByID(i),
                a = this.mArmy.getRole(0, 0).getComponent(At);
            a.avatar_3p.mem_rid != s.ml ? a.changeRoleMode(s.ml, Laya.Handler.create(this, () => {
                t.call(e)
            })) : t.call(e)
        }
        refreshGaogen(e, t, i = 0, s = 0) {
            i || (i = f.getPlayerGaogen());
            let a = d.getItemByID(i).ae;
            this.showSkin().ae;
            s || (s = f.getPlayerJewel());
            let n = d.getItemByID(s).ae;
            bt.loadShoesRes(Laya.Handler.create(this, () => {
                _t.refreshCollectables(this.map_main, a, 0);
                let i = this.mArmy.getRole(0, 0).getComponent(At);
                a != i.wear_shoes_name && i.wear(bt.Reward_Shoes, a), n != i.wear_jewelry_name && i.wear(bt.Reward_Jewelry, n), t.call(e)
            }), a)
        }
        freeTry(e, t, i) {
            let s = this.mArmy.getRole(0, 0).getComponent(At);
            1 == e.sid && s.changeRoleMode(e.ml, Laya.Handler.create(this, () => {
                i.call(t)
            })), 2 == e.sid && (s.wear(bt.Reward_Jewelry, e.ae), i.call(t))
        }
        initPhysicsEngine() {
            Laya.timer.loop(1, this, () => {
                it.pushFPS(), K.onUpdate(), this.updatePhysics()
            })
        }
        updatePhysics() {
            Laya.timer.callLater(this, () => {
                this.scene3D_main && (this.scene3D_main.physicsSimulation.fixedTimeStep = .001 * it.getDelta())
            })
        }
        addRole(e) {
            let t = St.createByUnity(this.scene3D_main, e, this.hp_player_birth.transform.position);
            this.mArmy.addRole(0, t), t.addComponent(Lt).initValue(this, 0, this.mArmy, this.map_main.getChildByName("Segments"))
        }
        cleanMap() {
            if (this.scene3D_main) {
                this.effect_win.removeSelf();
                let e = this.mArmy.getRole(0, 0);
                if (e) {
                    e.getComponent(At).destroyHpFoots(), e.removeSelf()
                }
                this.map_main && (K.recoveryComplexSP(this.map_main), this.map_main.removeSelf()), Laya.loader.getRes(H.instance.getCompleteResByID(20001)).removeSelf(), Laya.loader.getRes(H.instance.getCompleteResByID(20002)).removeSelf(), K.recoveryComplexSP(this.scene3D_main), this.scene3D_main.destroy()
            }
            this.way_role.length > 0 && this.way_role.forEach(e => {
                let t = e.getComponent(Xt);
                t.playIdle(), t.destroy(), K.recoverySP(e)
            }), this.win_role.length > 0 && this.win_role.forEach(e => {
                let t = e.getComponent(dt);
                t.playIdle(), t.destroy(), K.recoverySP(e)
            }), this.way_role.splice(0, this.way_role.length), this.win_role.splice(0, this.win_role.length), this.scene3D_main = null, this.map_main = null
        }
        playwinRole() {
            if (this.win_role.length > 0)
                for (let e = 0; e < this.win_role.length; e++) {
                    this.win_role[e].getComponent(dt).playWin()
                }
        }
        roleShot(e, t, i, s, a) {}
        bulletAttack(e, t, i) {}
        roleGetDem() {
            f.addGold(1), H.instance.playSound(50009, 1), console.info("获得1个钻石"), kt.instance.setGoldLabel()
        }
        roleWinEvent(e) {
            console.log("出现胜利")
       
                console.info("胜利事件回调", e);
                let t = [50005];
                H.instance.playSound(t[_.getIntegerInRandom(t.length - 1, 0)], 1),
                 this.mFSM.isInState(Yt.instance), 
                 y.is_win ||
                  H.instance.playSound(50003, 1),
                  Laya.timer.once(1e3, this, () => {
                    if (y.tryShoes && y.is_try_shoes) {
                        y.is_try_shoes = !1;
                        let t = d.getItemState(y.tryShoes.id);
                        if (t && 2 != t.state) {}
                        // return 
                        // void Zt.instance.openScene(Ht.SCENE_NAME, !1, {
                        //     isWin: !0,
                        //     multiple: e
                        // })
                    }
                    Zt.instance.openScene(Dt.SCENE_NAME, !1, e)
                })
        
        }
        roleFailtEvent() {
            console.log("出现失败")
                if (console.info("失败事件回调"), this.mFSM.isInState(Yt.instance), 
                this.camera_script.aim_object = null, y.tryShoes && y.is_try_shoes) {
                    y.is_try_shoes = !1;
                    let e = d.getItemState(y.tryShoes.id);
                    if (e && 2 != e.state)  {}
                    // void Zt.instance.openScene(Ht.SCENE_NAME, !1, {
                    //     isWin: !1,
                    //     multiple: 0
                    // })
                }
                Zt.instance.openScene(Rt.SCENE_NAME, !1)
           
        }
        roleAnimWalkHit() {
            console.info("roleAnimWalkHit")
        }
        roleAnimClap() {
            console.info("roleAnimClap"), H.instance.playSound(50011, 1)
        }
        roleChangeShoes(e) {
            let t = this.mArmy.getRole(0, 0).getComponent(At);
            t.wear(bt.Reward_Shoes, e), _t.refreshCollectables(this.map_main, e, t.role.transform.position.z), y.is_try_shoes = !0
        }
        roleAtkExeEvent(e, t, i) {
            t.getComponent(At).behert(e, i)
        }
        roleBehurtExeEvent(e, t, i) {
            if (i.type == et.TYPE_REVIVE) console.log(t.id + " 复活 并 恢复 " + -i.real + " 生命");
            else if (i.type == et.TYPE_CURE) console.log(e.id + " 治疗 " + t.id + " 恢复 " + -i.real + " 生命");
            else {
                let s = "";
                s = i.type == et.TYPE_NORMAL ? "普通攻击" : i.skill instanceof De ? "技能-" + i.skill.skill_name : "技能-" + i.skill.buff_name;
                let a = "";
                i.is_crit && (a = "暴击！"), console.log(e.id + " 对 " + t.id + " 造成 [" + s + "] " + i.real + " 伤害." + a)
            }
        }
        roleSkillExeEvent(e) {
            e.mSkillSys.role
        }
        roleFsmEnterEvent(e, t) {
            if (t instanceof se) {
                let e = this.scene3D_main.getChildByName("Finish");
                this.camera_script.goWinSuper(e)
            }
        }
        removeRole(e, t) {
            var i = e.indexOf(t);
            i > -1 && e.splice(i, 1)
        }
        roleSkillAction(e, t, i) {
            je.roleSkillAction(e, t, i)
        }
        skillStateUpdate(e, t) {
            e.role == this.mArmy.getRole(0, 0) && t.skill_id
        }
        roleBuffAction(e, t, i) {
            je.roleBuffAction(e, t, i)
        }
        buffsStateUpdate(e, t) {}
        onBtnShop() {
            VkApp.addLoadingCircle();  //添加loading
            Zt.instance.openScene(Ot.SCENE_NAME, !1)
        }
        onBtnFashion() {
            VkApp.addLoadingCircle();  //添加loading
            Zt.instance.openScene(jt.SCENE_NAME, !1)
        }
        onBtnSetting() {
            VkApp.addLoadingCircle();  //添加loading
            Zt.instance.openScene(xt.SCENE_NAME, !1)
        }
        onBtnTurn() {
            VkApp.addLoadingCircle();  //添加loading
            Zt.instance.openScene(Gt.SCENE_NAME, !1)
        }
        intoFashion(e) {
            VkApp.addLoadingCircle();  //添加loading
            this.mFSM.isInState(Yt.instance), y.is_try_shoes = !1, this.camera_script.aim_object = null, y.challengeItem = null, y.isChallengeItem = null, y.fashionItem = e, Zt.instance.reloadLevelMapAuto()
        }
        intoChallenge(e) {
            VkApp.addLoadingCircle();  //添加loading
            this.mFSM.isInState(Yt.instance), y.is_try_shoes = !1, this.camera_script.aim_object = null, y.fashionItem = null, y.challengeItem = e, y.isChallengeItem = e, Zt.instance.reloadLevelMapAuto()
        }
        initLevel() {
            var e = f.getGrade(),
                t = e % 5;
            0 == t && (t = 5);
            for (var i = 0; i < this.level_pro.numChildren; i++) {
                var s, a = this.level_pro.getChildAt(i);
                if (i < t) {
                    if (t - i <= 1) {
                        if (console.info("当前玩", i), console.info("当前玩000：", t), a.skin = "img/home/topBarGreen.png", i < 5)(s = a.getChildByName("lb_level")).text = e - t + i + 1 + "", s.color = "#FFFFFF"
                    } else if (console.info("当前玩", i), console.info("当前玩000：", t), a.skin = "img/home/topBarBlue.png", i < 5)(s = a.getChildByName("lb_level")).text = e - t + i + 1 + "", s.color = "#FFFFFF"
                } else if (console.info("还未玩", i), a.skin = "img/home/topbar_lightGray.png", i < 5)(s = a.getChildByName("lb_level")).text = e - t + i + 1 + "", s.color = "#FFFFFF"
            }
        }
    }
    Jt.SCENE_NAME = "test/GameScene.scene", Jt.is_show_shadow = !0;
    class Zt {
        constructor() {
            this.eventDispatcher = null, Zt.instance = this, this.eventDispatcher = new Laya.EventDispatcher
        }
        openScene(e, t, i = null) {
            Laya.Scene.load(e, Laya.Handler.create(this, e => {
                e.open(t, i)
            }))
        }
        screenAdaptation(e, t = 100) {}
        btnClick(e, t, i = null) {
            H.instance.playSound(5e4, 1), e && t && t.apply(e, i)
        }
        reloadLevelMapAuto() {
            Jt.instance.isPlaying = !1, Jt.instance.reloadMapAuto()
        }
        gameOver(e) {}
        conversion(e, t = 1) {
            e || (e = 0);
            var i = "";
            return e < 1e3 && (i = e.toFixed(0) + ""), e >= Math.pow(10, 3) && (i = (e / Math.pow(10, 3)).toFixed(t) + "K"), e >= Math.pow(10, 6) && (i = (e / Math.pow(10, 6)).toFixed(t) + "M"), e >= Math.pow(10, 9) && (i = (e / Math.pow(10, 9)).toFixed(t) + "B"), e >= Math.pow(10, 12) && (i = (e / Math.pow(10, 12)).toFixed(t) + "T"), e >= Math.pow(10, 15) && (i = (e / Math.pow(10, 15)).toFixed(t) + "aa"), e >= Math.pow(10, 18) && (i = (e / Math.pow(10, 18)).toFixed(t) + "ab"), e >= Math.pow(10, 21) && (i = (e / Math.pow(10, 21)).toFixed(t) + "ac"), e >= Math.pow(10, 24) && (i = (e / Math.pow(10, 24)).toFixed(t) + "ad"), e >= Math.pow(10, 27) && (i = (e / Math.pow(10, 27)).toFixed(t) + "ae"), e >= Math.pow(10, 30) && (i = (e / Math.pow(10, 30)).toFixed(t) + "af"), e >= Math.pow(10, 33) && (i = (e / Math.pow(10, 33)).toFixed(t) + "ag"), e >= Math.pow(10, 36) && (i = (e / Math.pow(10, 36)).toFixed(t) + "ah"), e >= Math.pow(10, 39) && (i = (e / Math.pow(10, 39)).toFixed(t) + "ai"), e >= Math.pow(10, 42) && (i = (e / Math.pow(10, 42)).toFixed(t) + "aj"), e >= Math.pow(10, 45) && (i = (e / Math.pow(10, 45)).toFixed(t) + "ak"), i
        }
        delay(e) {
            e.visible = !1, Laya.timer.once(S.receiving_button, this, () => e.visible = !0)
        }
    }
    Zt.instance = null;
    class Qt extends e.test.ChallengeLevelUI {
        constructor() {
            super(), this.listData = [], this.selectindex = 0, this.page_num = 1, this.is_change = !0, this.pageIndex = 0, this.is_down = !1, a.setScale(this), this.root.y = a.height() - this.root.height, Qt.instance = this
        }
        onOpened() {
            console.log("挑战")
            VkApp.removeLoadingCircle();//删除loading
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
                // VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            this.initData(), this.initBtn()
            this._children[1]._children[3]._children[0].visible=false
            this._children[1]._children[3]._children[1].y=25
            this._children[1]._children[3]._children[2].y=25
            this._children[1].y=250
        }
        initBtn() {
            this.btnCancel.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnCancel]), this.btnSure.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnSure]), this.btnUse.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnUse]), this.btnFree.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnFree]), this.btnAgain.on(Laya.Event.CLICK, this, Zt.instance.btnClick, [this, this.onBtnAgain]), this.level_list.on(Laya.Event.MOUSE_DOWN, this, this.onDown), this.level_list.on(Laya.Event.MOUSE_MOVE, this, this.onMouse), this.level_list.on(Laya.Event.MOUSE_UP, this, this.onMouseOut), this.level_list.on(Laya.Event.MOUSE_OUT, this, this.onMouseOut)
        }
        initData() {
            this.level_list.hScrollBarSkin = "", this.level_list.selectEnable = !0, this.level_list.selectHandler = new Laya.Handler(this, this.onSelect), this.listData = d.getItemsConditionsByType(1, 5), this.refreshListData()
        }
        refreshListData() {
            this.level_list.dataSource = [];
            let e, t = [],
                i = 0;
            for (let s = 0; s < this.listData.length; s++) {
                let a = this.listData[s].conditions[0].item,
                    n = d.getUserBoxItem(a),
                    r = "",
                    o = "";
                y.isChallengeItem && a.id == y.isChallengeItem.id && (i = s), 2 == this.listData[s].state || 1 != a.ct || n.yn ? 2 == this.listData[s].state ? (r = "img/challenge/ch_21.png", o = "img/challenge/ch_11.png") : 2 == this.listData[s].state || n.iv ? 2 != this.listData[s].state && n.iv && (r = "img/challenge/ch_23.png", o = "img/challenge/ch_10.png") : (r = "img/challenge/ch_22.png", o = "") : (r = "img/challenge/ch_21.png", o = ""), e = {
                    ivItem: {
                        skin: "img/challenge/" + a.bg
                    },
                    ivLevel: {
                        skin: "img/challenge/" + s + ".png"
                    },
                    ivBg: {
                        skin: r
                    },
                    ivName: {
                        skin: "img/challenge/" + a.ic
                    },
                    ivWin: {
                        skin: o
                    }
                }, t.push(e)
            }
            this.level_list.dataSource = t, this.level_list.refresh(), this.pageIndex = i, this.level_list.tweenTo(this.page_num * this.pageIndex, 200, Laya.Handler.create(this, () => {
                this.level_list.scrollBar.value = this.level_list.scrollBar.value - 5, this.is_change = !0, this.level_list.selectedIndex = this.pageIndex
            }))
        }
        onDown() {
            this.is_down = !0, this.moveValue = this.level_list.scrollBar.value
        }
        onMouse() {
            this.is_down
        }
        onMouseOut() {
            this.outValue = this.level_list.scrollBar.value, this.is_down && (this.is_down = !1, this.outValue >= this.moveValue ? this.listTweenPos(1) : this.outValue < this.moveValue && this.listTweenPos(0))
        }
        listTweenPos(e) {
            0 == e && (this.pageIndex > 0 && (this.pageIndex = this.pageIndex - 1, this.level_list.tweenTo(this.page_num * this.pageIndex, 200, Laya.Handler.create(this, () => {
                this.level_list.scrollBar.value = this.level_list.scrollBar.value - 5, this.is_change = !0, this.level_list.selectedIndex = this.pageIndex
            }))), this.pageIndex <= 0 && this.level_list.tweenTo(0, 200, Laya.Handler.create(this, () => {
                this.level_list.scrollBar.value = this.level_list.scrollBar.value - 5, this.is_change = !0, this.level_list.selectedIndex = this.pageIndex
            }))), 1 == e && (this.pageIndex >= Math.ceil(this.listData.length / this.page_num) - 1 && this.level_list.tweenTo(this.page_num * this.pageIndex, 200, Laya.Handler.create(this, () => {
                this.level_list.scrollBar.value = this.level_list.scrollBar.value - 5, this.is_change = !0, this.level_list.selectedIndex = this.pageIndex
            })), this.pageIndex < Math.ceil(this.listData.length / this.page_num) - 1 && (this.pageIndex = this.pageIndex + 1, this.level_list.tweenTo(this.page_num * this.pageIndex, 200, Laya.Handler.create(this, () => {
                this.level_list.scrollBar.value = this.level_list.scrollBar.value - 5, this.is_change = !0, this.level_list.selectedIndex = this.pageIndex
            }))), console.info("this.pageIndex:", this.pageIndex), this.pageIndex, Math.ceil(this.listData.length / this.page_num)), this.listData.length, this.page_num
        }
        onSelect(e) {
            if (-1 == e) return;
            if (!this.is_change) return;
            this.is_change = !1, this.selectindex = e;
            let t = this.listData[e],
                i = this.listData[e].conditions[0].item,
                s = d.getUserBoxItem(i);
            this.btnFree.visible = !1, this.btnSure.visible = !1, this.btnUse.visible = !1, 
            this.btnAgain.visible = !1, this.spGold.visible = !0, 2 == t.state || 1 != i.ct || s.yn ? 2 == t.state ? 
            (this.spGold.visible = !1, this.btnUse.visible = !0) : 2 == t.state || s.iv ? 2 != t.state && s.iv && (this.btnAgain.visible = !0) :
             this.btnSure.visible = !0 : this.btnFree.visible = !0, this.lbGold.text = i.tn + ""
        }
        onBtnCancel() {
            VkApp.showRandomInterAd();// 主界面 按钮关闭 随机插屏广告
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
               // VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 230, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 300, null);
            y.isChallengeItem = null, this.close()
        }
        onBtnSure() {
            U.mainCH.showVideoAd(e => {
                if (e) {
                    let e = this.listData[this.selectindex].conditions[0].item;
                    d.setUserIv(e, 1), this.onBtnUse()
                }
            })
        }
        onBtnAgain() {
            U.mainCH.showVideoAd(e => {
                if (e) {
                    let e = this.listData[this.selectindex].conditions[0].item;
                    d.setUserIv(e, 1), this.onBtnUse()
                }
            })
        }
        onBtnUse() {
            let e = this.listData[this.selectindex].conditions[0].item;
            Jt.instance.intoChallenge(e), this.close()
            VkApp.showRandomInterAd();// 主界面 按钮关闭 随机插屏广告
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
             //   VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 230, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 300, null);
        }
        onBtnFree() {
            let e = this.listData[this.selectindex].conditions[0].item;
            d.setUserYn(e, 1), d.setUserIv(e, 1), Jt.instance.intoChallenge(e), this.close()
             VkApp.showRandomInterAd();// 主界面 按钮关闭 随机插屏广告
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
              //  VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 230, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 300, null);
        }
        onDisable() {
            f.saveData()
        }
        onClosed() {
            Qt.instance = null
        }
    }
    Qt.SCENE_NAME = "test/ChallengeLevel.scene";
    class $t extends Laya.Script {
        constructor() {
            super(), this.rate = 1
        }
        onEnable() {
            this.node = this.owner
        }
        onUpdate() {
            this.node && (this.node.rotation += 1 * this.rate)
        }
    }
    class ei extends Laya.Script {
        constructor() {
            super(), this.scaleNum = 1, this.scaleMin = .9, this.scaleMax = 1.1, this.scaleTime = 400, this.playTime = 0
        }
        onEnable() {
            this.node = this.owner, this.node.scale(this.scaleNum, this.scaleNum), this.timeLine = new Laya.TimeLine, this.anim()
        }
        anim() {
            this.playTime > 0 ? Laya.timer.once(this.playTime, this, () => {
                this.timeLine.to(this.node, {
                    scaleX: this.scaleMin,
                    scaleY: this.scaleMin
                }, this.scaleTime), this.timeLine.to(this.node, {
                    scaleX: this.scaleMax,
                    scaleY: this.scaleMax
                }, 2 * this.scaleTime), this.timeLine.to(this.node, {
                    scaleX: this.scaleNum,
                    scaleY: this.scaleNum
                }, this.scaleTime), this.timeLine.play(0, !0)
            }) : (this.timeLine.to(this.node, {
                scaleX: this.scaleMin,
                scaleY: this.scaleMin
            }, this.scaleTime), this.timeLine.to(this.node, {
                scaleX: this.scaleMax,
                scaleY: this.scaleMax
            }, 2 * this.scaleTime), this.timeLine.to(this.node, {
                scaleX: this.scaleNum,
                scaleY: this.scaleNum
            }, this.scaleTime), this.timeLine.play(0, !0))
        }
        onDisable() {
            this.timeLine.pause(), this.timeLine.destroy()
        }
    }
    class ti extends Laya.Script {
        constructor() {
            super(), this.rate = .5
        }
        onEnable() {
            this.node = this.owner
        }
        onUpdate() {
            this.node && (this.node.rotation += 1 * this.rate)
        }
        onDisable() {
            this.node.offAll(), this.node.removeSelf(), this.node.destroy()
        }
    }
    class ii extends e.test.TurntableUI {
        constructor() {
            super(), this.resultIndex = 1, this.mulList = [1, 50, 1, 100, 1, 150], this.imgList = ["img/turnable/zs1.png", "img/turnable/zs1.png", "img/turnable/zs1.png", "img/turnable/zs2.png", "img/turnable/zs2.png", "img/turnable/zs3.png"], this.imgTextList = ["img/turnable/text3.png", "img/turnable/text1.png", "img/turnable/text4.png", "img/turnable/text1.png", "img/turnable/text2.png", "img/turnable/text1.png"], this.rewardItem = null, this.rewardPerson = null, this.rewardSkin = null, this.rewardShoes = null, this.is_turn = !1, this.is_Item = !1, this.maxtime = 3600, this.giveTicket = 0, a.setScale(this), Zt.instance.screenAdaptation(this.root)
        }
        onOpened(e = !0) {
            console.log("转盘")
            VkApp.removeLoadingCircle();//删除loading
            VkApp.hideMoreGameBtn();
            VkApp.hideShareBtn(); 
            VkApp.hideClubBtn();
            VkApp.hideBanner(); 
            VkApp.hideRankBtn();
            VkApp.hideSingleArr();
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
                // VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            S.normal_screen && Laya.timer.once(S.delay_screen_time, this, () => {
                U.mainCH.showInterstitialAd()
            }), this.setRewardSkin(), this.init2DUI(), e && this.setGiveTicket(), this.refreshData()
        }
        init2DUI() {
            this.btnStart.on(Laya.Event.CLICK, this, this.onBtnStart), 
            // this.btnStart1.on(Laya.Event.CLICK, this, this.onBtnStart), 
            this.btnClose.on(Laya.Event.CLICK, this, this.onBtnClose), 
            this.btnGetTicket.on(Laya.Event.CLICK, this, this.onBtnGetTicket), Laya.timer.loop(1, this, () => {
                this.update()
            })
        }
        setGiveTicket() {}
        refreshData() {
            if (console.log("免费抽奖次数：", this.giveTicket), console.log("今日已获得卷：", f.getTicket()),
             this.lbHint.visible = !0, this.giveTicket > 0) console.info("11111"), this.lbHint.text = "免费抽奖次数x" + this.giveTicket,
              this.btnGetTicket.visible = !1, this.btnStart.visible = !0;
            else {
                if (y.new_day) {
                    if (this.lbHint.text = "", 3 - y.lotteryNum > -1 && 0 != y.lotteryNum) {
                        let e = 3 - y.lotteryNum;
                        y.lotteryNum > 3 && (y.lotteryNum = 0)
                        // , this.lbHint.text = "再抽取" + e + "次必中大奖！"
                    }
                    console.info("22222")
                } else {
                    if (3 - y.lotteryNum > -1) {
                        let e = 3 - y.lotteryNum;
                        y.lotteryNum > 3 && (y.lotteryNum = 0)
                        //,  this.lbHint.text = "再抽取" + e + "次必中大奖！"
                    }
                    console.info("3333")
                }
                if (f.getTicket() > 0) this.btnGetTicket.visible = !1, this.btnStart.visible = !0, console.info("44444");
                else if (this.btnStart.visible = !1, this.btnGetTicket.visible = !0, console.info("55555"), 3 - y.lotteryNum > -1 && 0 != y.lotteryNum) {
                    let e = 3 - y.lotteryNum;
                    y.lotteryNum > 3 && (y.lotteryNum = 0)
                    // , this.lbHint.text = "再抽取" + e + "次必中大奖！", console.info("66666：", e)
                }
            }
        }
        update() {
            this.is_turn && this.checkPointerAngel()
        }
        onBtnStart() {
            this.giveTicket > 0 ? (this.btnStart.disabled = !0, this.btnGetTicket.disabled = !0, y.lotteryNum++, this.is_turn ||
                 (this.is_turn = !0, this.giveTicket--, this.startTable(), this.refreshData())) : f.getTicket() > 0 ?
                  (this.btnStart.disabled = !0, this.btnGetTicket.disabled = !0, y.lotteryNum++, this.is_turn || 
                    (this.is_turn = !0, f.decTicket(), this.refreshData(), this.startTable())) : 
                    S.is_turn_video ? this.onBtnGetTicket() : U.mainCH.showToast("抽奖券不足，请先领取抽奖券")
        }
        onBtnGetTicket() {
            U.mainCH.showVideoAd(e => {
                e && (y.lotteryNum++, this.is_turn = !0, this.btnGetTicket.disabled = !0, this.refreshData(), this.startTable())
            })
        }
        onBtnGetAward() {
            let e = this.rewardItem;
            console.info("大转盘领取奖励：", e), d.incItem(e), p.add("skin", 1), f.saveData(), 1 == e.sid && (f.setPlayerSkin(e.id),
            VkApp.showToast(window.getLanguageByKey("Get_Success"))),  //Nt.instance.showHint("恭喜获得皮肤一个")
             2 == e.sid && (f.setPlayerJewel(e.id),VkApp.showToast(window.getLanguageByKey("NGet_Success")) ),// Nt.instance.showHint("恭喜获得饰品一个")),
              3 == e.sid && (f.setPlayerGaogen(e.id), VkApp.showToast(window.getLanguageByKey("Get_Success"))),//Nt.instance.showHint("恭喜获得高跟鞋一个")), 
              Jt.instance.refreshGaogen(this, () => {
                Jt.instance.refreshRole(this, () => {})
            }), Laya.timer.once(2e3, this, () => {
                this.setRewardSkin()
            })
        }
        onBtnClose() {
            VkApp.showRandomInterAd();// 主界面 按钮关闭 随机插屏广告
            VkApp.showMoreGameBtn(); //新增全屏按钮
            VkApp.showShareBtn(); //分享按钮

            if (!window.end) {
              //  VkApp.showBanner(); //显示底部banner矩阵
            }
            VkApp.showClubBtn(null, null, 10, 190); //显示社区按钮 
            //VkApp.showRankBtn(null, 10, null, 130); //显示排行榜按钮
            VkApp.showRecommendGames("singleIcon_401", null, 10, 100, null);
            VkApp.showRecommendGames("singleIcon_403", null, 10, 170, null);
            // VkApp.showRecommendGames("singleIcon_402", 10, null, 230, null);
            // VkApp.showRecommendGames("singleIcon_404", 10, null, 300, null);
            f.saveData(), Laya.timer.clearAll(this), this.btnClose.offAll(Laya.Event.CLICK), this.btnGetTicket.offAll(Laya.Event.CLICK), this.btnStart.offAll(Laya.Event.CLICK), this.btnStart1.offAll(Laya.Event.CLICK), this.close()
        }
        showSkin(e) {
            var t = this.table.getChildAt(e).getChildByName("ivAward"),
                i = this.table.getChildAt(e).getChildByName("lbAward"),
                s = this.table.getChildAt(e).getChildByName("ivText");
            t.skin = this.imgList[e], i.text = "x" + this.mulList[e], s.skin = this.imgTextList[e]
            s.scaleX=1.5;
            s.scaleY=1.5;
            s.x=85;
            s.y=12;
        }
        resetTable() {
            this.table.rotation = 0
        }
        startTable() {
            this.resetTable();
            let e = 100 * Math.random();
            if (console.log("num:", e), y.lotteryNum >= 3) {
                y.lotteryNum = 0;
                let e = [2, 4, 0];
                this.resultIndex = e[_.getIntegerInRandom(e.length - 1, 0)]
            } else if (e < 2) this.resultIndex = 2;
            else if (e >= 2 && e < 8) this.resultIndex = 0;
            else if (e >= 8 && e < 18) this.resultIndex = 4;
            else {
                let e = [1, 3, 5];
                this.resultIndex = e[_.getIntegerInRandom(e.length - 1, 0)]
            }
            let t = 1e3 * (4 * Math.random() + 4),
                i = 5 + ~~(5 * Math.random()),
                s = 60 * this.resultIndex + _.getRealInRandom(-25, 25);
            this.rotateTable(s + 360 * i, t), console.log("angle:", s)
        }
        rotateTable(e, t) {
            Laya.Tween.to(this.table, {
                rotation: e
            }, t, Laya.Ease.cubicOut, Laya.Handler.create(this, this.showResult))
        }
        showResult() {
            if (this.is_turn = !1, this.btnStart.disabled = !1, this.btnGetTicket.disabled = !1, console.info("抽奖结果:", this.resultIndex, this.mulList[this.resultIndex]), 1 == this.mulList[this.resultIndex]) f.setTicket(0), this.refreshData(), this.is_Item = !0, this.btnClose.disabled = !1, 2 == this.resultIndex && (this.rewardItem = this.rewardPerson, this.onBtnGetAward()), 4 == this.resultIndex && (this.rewardItem = this.rewardSkin, this.onBtnGetAward()), 0 == this.resultIndex && (this.rewardItem = this.rewardShoes, this.onBtnGetAward());
            else {
                var e = this.mulList[this.resultIndex];
                f.addGold(e), kt.instance.setGoldLabel(), 
                VkApp.showToast(window.getLanguageByKey("Get_Success_Diamond") + " x"+e)
                // Nt.instance.showHint("恭喜获得钻石 x" + e)
            }
        }
        checkPointerAngel() {
            let e = ~~Math.abs(this.table.rotation) % 360,
                t = 0;
            if (e >= 328 || e <= 28) t = 0;
            else if (e > 28 && e <= 88) t = 1;
            else if (e > 88 && e <= 148) t = 2;
            else if (e > 148 && e <= 208) t = 3;
            else if (e > 208 && e <= 268) t = 4;
            else {
                if (!(e > 268 && e <= 328)) return;
                t = 5
            }
            if (this.lastIndex == t) return;
            let i = this.table.getChildAt(t);
            if (this.setItemData(i, 1), null != this.lastIndex && null != this.lastIndex) {
                let e = this.table.getChildAt(this.lastIndex);
                this.setItemData(e, 0)
            }
            this.lastIndex = t
        }
        setItemData(e, t) {
            let i = e.getChildByName("light");
            i.visible = !!t
        }
        setRewardSkin() {
            let e = null,
                t = d.getItemsConditionsByType(1, 1).filter(e => 2 != e.state),
                i = d.getItemsConditionsByType(1, 2).filter(e => 2 != e.state),
                s = d.getItemsConditionsByType(1, 3).filter(e => 2 != e.state);
            if (t.length <= 0) this.rewardPerson = null, this.mulList[2] = 150, this.imgList[2] = "img/turnable/zs3.png", this.imgTextList[2] = "img/turnable/text1.png";
            else {
                let i = Math.floor(Math.random() * t.length);
                this.mulList[2] = 1, e = t[i].conditions[0].item, this.rewardPerson = e, this.imgList[2] = "img/skin/" + e.ic, this.imgTextList[2] = "img/turnable/text4.png"
            }
            if (i.length <= 0) this.rewardSkin = null, this.mulList[4] = 200, this.imgList[4] = "img/turn/gold4.png", this.imgTextList[4] = "img/turnable/text1.png";
            else {
                let t = Math.floor(Math.random() * i.length);
                this.mulList[4] = 1, e = i[t].conditions[0].item, this.rewardSkin = e, this.imgList[4] = "img/skin/" + e.ic, this.imgTextList[4] = "img/turnable/text2.png"
            }
            if (s.length <= 0) this.rewardShoes = null, this.mulList[0] = 200, this.imgList[0] = "img/turn/gold4.png", this.imgTextList[0] = "img/turnable/text1.png";
            else {
                let t = Math.floor(Math.random() * s.length);
                this.mulList[0] = 1, e = s[t].conditions[0].item, this.rewardShoes = e, this.imgList[0] = "img/skin/" + e.ic, this.imgTextList[0] = "img/turnable/text3.png"
            }
            for (var a = 0; a < 6; a++) this.showSkin(a)
        }
    }
    ii.SCENE_NAME = "test/Turntable.scene";
    class si {
        constructor() {}
        static init() {
            var e = Laya.ClassUtils.regClass;
            e("sceneui/ChallengeLevelUI.ts", Qt), e("sceneui/DefineSkinUI.ts", Bt), 
            e("anim/AnimLight.ts", $t), e("anim/AnimScale.ts", ei), e("navigate/NativeAd.ts", Mt),
             e("sceneui/FailUI.ts", Rt), e("sceneui/FashionUI.ts", jt), e("sceneui/FreeSkinUI.ts", Kt),
              e("sceneui/GameUI.ts", Jt), e("anim/AnimLightRotate.ts", ti), e("sceneui/LoadingUI.ts", Ft), 
              e("sceneui/SettingUI.ts", xt), e("sceneui/ShopUI.ts", Ot), e("sceneui/TrySkinUI.ts", Ht), 
              e("sceneui/TurntableUI1.ts", ii), e("sceneui/VictoryUI.ts", Dt)
        }
    }
    si.width = 640, si.height = 1138, si.scaleMode = "showall", si.screenMode = "none", si.alignV = "top", si.alignH = "center", si.startScene = "test/Loading.scene", si.sceneRoot = "", si.debug = !1, si.stat = !1, si.physicsDebug = !1, si.exportSceneToJson = !0, si.init();
    new class {
        constructor() {
            window.Laya3D ? Laya3D.init(si.width, si.height) : Laya.init(si.width, si.height, Laya.WebGL), Laya.Physics && Laya.Physics.enable(), Laya.DebugPanel && Laya.DebugPanel.enable(), Laya.stage.scaleMode = si.scaleMode, Laya.stage.screenMode = si.screenMode, Laya.stage.alignV = si.alignV, Laya.stage.alignH = si.alignH, Laya.URL.exportSceneToJson = si.exportSceneToJson, (si.debug || "true" == Laya.Utils.getQueryString("debug")) && Laya.enableDebugPanel(), si.physicsDebug && Laya.PhysicsDebugDraw && Laya.PhysicsDebugDraw.enable(), si.stat && Laya.Stat.show()
            //Taylor 三端平台适配
            if (Laya.Browser.onPC) {
                Laya.stage.scaleMode = "showall";
                Laya.stage.alignV = "middle";
                Laya.stage.alignH = "center";
            } else {
                Laya.stage.scaleMode = "fixedwidth";
                Laya.stage.alignV = "top";
                Laya.stage.alignH = "left";
            };

            // Laya.stage.scaleMode= Laya.Stage.SCALE_FIXED_AUTO 
            //Taylor 苹果包读取远端代码
            // if (window.isOdr) {
            //     Laya.URL.basePath = Laya.URL.rootPath = window["RES_CDN_URL"];
            // };
            Laya.URL.basePath = Laya.URL.rootPath = window.xz_lang_file_url;

            // //Taylor 退后台 回前台
            // window.document.addEventListener('visibilitychange', function () {
            //     if (window.document.hidden) {
            //         console.log("Sy --- 用户离开了当前页面");
            //         // Laya.SoundManager.stopAll();
            //     } else {
            //         console.log("Sy --- 用户打开或回到页面");
            //         // y.Instate.Distribute("PlayBG", 1);
            //     }
            // })
               //Yd 视频和插屏声音处理
               VkApp.VKWebAppViewHideCallBack = () => {
                console.log("Sy --- 关闭声音");
                window.isVideo = true;
                CoinAppAudio.stopAll();
            }
        VkApp.VKWebAppViewRestoreCallBack = () => {
            console.log("Sy --- 开启声音");
            if(window.startVideo)return
            window.isVideo = false;
            if (!VkApp.isSoundMute) {
                CoinAppAudio.playMusic(CoinAppAudio.bgm);
            }
        }
            Laya.ResourceVersion.enable("../version.json", Laya.Handler.create(this, this.onVersionLoaded), Laya.ResourceVersion.FILENAME_VERSION)
        }
        onVersionLoaded() {
            Laya.AtlasInfoManager.enable("../fileconfig.json", Laya.Handler.create(this, this.onConfigLoaded))
        }
        onConfigLoaded() {
            si.startScene && Laya.Scene.open(si.startScene)
        }
    }
}();