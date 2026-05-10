'use strict';

// [已清理] require/ModuleLoader 拦截器已移除（方案3已废弃，BEM无法通过此方式获取）

Object.defineProperty(exports, '__esModule', { value: true });

// =====================================================================
// [V8 TIMERS HOOK] 修复"时间线割裂"问题
//   setTimeScale 仅加速 Cocos 引擎的 dt，但 V8 原生定时器
//   (setTimeout/setInterval) 依然以 1x 真实时钟运行。此 Hook 将定时器
//   延时除以当前加速倍率，使 JS 异步延时与引擎加速保持同步。
// =====================================================================
(function () {
    'use strict';
    try {
        if (globalThis._timersHooked) return;

        var origSetTimeout = globalThis.setTimeout;
        var origSetInterval = globalThis.setInterval;
        var origClearTimeout = globalThis.clearTimeout;
        var origClearInterval = globalThis.clearInterval;

        if (typeof origSetTimeout !== 'function') {
            console.log('[TIMERS HOOK] setTimeout not available, skipping.');
            return;
        }

        function _getDynamicSpeed() {
            try {
                if (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') {
                    var s = _SPEED_LEVELS[_speedIdx];
                    return (typeof s === 'number' && s > 0) ? s : 1;
                }
            } catch (e) { }
            return 1;
        }

        globalThis.setTimeout = function (handler, timeout) {
            var speed = _getDynamicSpeed();
            var scaledTimeout = (typeof timeout === 'number' && timeout > 0)
                ? Math.max(0, Math.round(timeout / speed))
                : timeout;
            var args = [];
            for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
            if (args.length > 0) {
                return origSetTimeout.call(this, handler, scaledTimeout, args[0], args[1], args[2], args[3]);
            }
            return origSetTimeout.call(this, handler, scaledTimeout);
        };

        globalThis.setInterval = function (handler, timeout) {
            var speed = _getDynamicSpeed();
            var scaledTimeout = (typeof timeout === 'number' && timeout > 0)
                ? Math.max(1, Math.round(timeout / speed))
                : timeout;
            var args = [];
            for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
            if (args.length > 0) {
                return origSetInterval.call(this, handler, scaledTimeout, args[0], args[1], args[2], args[3]);
            }
            return origSetInterval.call(this, handler, scaledTimeout);
        };

        if (typeof origClearTimeout === 'function') globalThis.clearTimeout = origClearTimeout;
        if (typeof origClearInterval === 'function') globalThis.clearInterval = origClearInterval;

        globalThis._timersHooked = true;
        globalThis._origSetTimeout = origSetTimeout;
        globalThis._origSetInterval = origSetInterval;

        console.log('[TIMERS HOOK] setTimeout/setInterval globally hooked for speed sync.');
    } catch (e) {
        console.log('[TIMERS HOOK] Hook failed: ' + e);
    }
})();

// 함수 실행 시간을 측정하는 유틸리티 함수
function measurePerformance(fn, functionName) {
    return function (...args) {
        const startTime = Date.now();
        const result = fn.apply(this, args);

        // Promise인 경우 (async 함수)
        if (result && typeof result.then === 'function') {
            return result.then((res) => {
                const executionTime = Date.now() - startTime;
                if (executionTime > 100) {
                    console.log(`${functionName}() took ${executionTime}ms (over 0.1 second)`);
                }
                return res;
            }).catch((err) => {
                const executionTime = Date.now() - startTime;
                if (executionTime > 100) {
                    console.log(`${functionName}() took ${executionTime}ms (over 0.1 second) - failed with error: ${err}`);
                }
                throw err;
            });
        } else {
            // 일반 함수
            const executionTime = Date.now() - startTime;
            if (executionTime > 100) {
                console.log(`${functionName}() took ${executionTime}ms (over 0.1 second)`);
            }
            return result;
        }
    };
}


require('./boot.js')
const bootres = require('./bootres.js')
const bgani = require('./bgani.js')
const title = require('./title.js')
const { TitleXcentNoticePopup } = require('./title_popups.js')
const { PreTexts } = require('./pre_data.js')
const { Util } = require('./util.js')
const { EntryUtil } = require('./entry_util.js')
const { ResolutionHandler } = require('./resolution.js');

global.pre = {}

var TitleScenePre = new title.TitleScenePre()
global.TitleScenePre = TitleScenePre

if (_getenv('xcent.notice', 0)) {
    var TitleXcentNotice = new TitleXcentNoticePopup()
}

/**
 * 시작 절차
 * 1. (_application_start_contents) 엔진에서 호출되어 시작됩니다.
 * 2. (_display_logo) CI를 보여줍니다.
 * 3. (_async_load_version_info) 엔트리서버 쿼리를 진행합니다.
 * 4. (_show_app_upgrade) 앱업데이트 메시지를 표시합니다.
 * 5. (_start_title_scene) 엔트리서버 결과를 정상적으로 받아오면 타이틀 씬을 실행합니다.
 * 6. (_start_patch) 사전다운로드가 필요하다면 해당 버전에 맞게 패치정보 세팅 후 패치를 진행합니다.
 * 7. (_show_maintenance) 만약 점검중이라면 점검 레이어를 표시합니다.
 * 8. (_start_patch) 패치를 진행합니다.
 * 9. (_load_application_resources) 패치가 완료되면 제어를 script 단으로 넘깁니다.
 */

cc.Device.setKeepScreenOn(true);

var xcent_notice_list_before_patch = []
var xcent_notice_list_after_patch = []

const _original_process_next_notice = function () {
    if (xcent_notice_list_before_patch.length > 0) {
        const nextNotice = xcent_notice_list_before_patch[0];
        console.log('nextNotice : ', JSON.stringify(nextNotice))

        TitleXcentNotice.createScene(function () {
            check_xcent_notice()
        })
        TitleXcentNotice.setNotice(nextNotice.notice_text_obj.notice_title, nextNotice.notice_text_obj.notice_content);

        const target_layer = TitleScenePre.getTargetLayer();
        TitleXcentNotice.show(target_layer)
    } else {
        TitleScenePre.startPatch()
    }
};
const process_next_notice = measurePerformance(_original_process_next_notice, 'process_next_notice');

const _original_check_xcent_notice = function () {
    console.log('check_xcent_notice', xcent_notice_list_before_patch.length)
    if (xcent_notice_list_before_patch.length > 0) {
        xcent_notice_list_before_patch.shift();
    }
    process_next_notice();
};
const check_xcent_notice = measurePerformance(_original_check_xcent_notice, 'check_xcent_notice');

// 네이티브에서 호출됨.(중국 공지 데이터)
function _original_OnXcentLoadNoticeData(result) {
    const parsedData = JSON.parse(result);

    // notice_type 으로 보여 주는 타이밍이 다름
    if (parsedData.notice_list) {
        xcent_notice_list_before_patch = parsedData.notice_list.filter(function (notice) { return notice.notice_type === 1008 });
        xcent_notice_list_after_patch = parsedData.notice_list.filter(function (notice) { return notice.notice_type === 1010 });
    }

    console.log('xcent_notice_list_before_patch : ', xcent_notice_list_before_patch.length)
    console.log('xcent_notice_list_after_patch : ', xcent_notice_list_after_patch.length)

    if (xcent_notice_list_before_patch.length > 0) {
        xcent_notice_list_before_patch.sort(function (a, b) { return a.order - b.order });
    }
    if (xcent_notice_list_after_patch.length > 0) {
        xcent_notice_list_after_patch.sort(function (a, b) { return a.order - b.order });
    }
    process_next_notice();
}

const OnXcentLoadNoticeData = measurePerformance(_original_OnXcentLoadNoticeData, 'OnXcentLoadNoticeData');
global.OnXcentLoadNoticeData = OnXcentLoadNoticeData;

function _original_process_next_notice_after_patch() {
    console.log("process_next_notice_after_patch")
    if (xcent_notice_list_after_patch.length > 0) {
        console.log("xcent_notice_list_after_patch.length > 0");
        const nextNotice = xcent_notice_list_after_patch[0];
        console.log('nextNotice after patch : ', JSON.stringify(nextNotice))

        TitleXcentNotice.createScene(function () {
            check_after_patch_notice()
        })
        TitleXcentNotice.setNotice(nextNotice.notice_text_obj.notice_title, nextNotice.notice_text_obj.notice_content);

        const target_layer = TitleScenePre.getTargetLayer();
        TitleXcentNotice.show(target_layer)
    } else {
        console.log("xcent_notice_list_after_patch.length === 0");
        TitleScenePre.onAfterPatch();
    }
}

const process_next_notice_after_patch = measurePerformance(_original_process_next_notice_after_patch, 'process_next_notice_after_patch');

function _original_check_after_patch_notice() {
    console.log('check_after_patch_notice', xcent_notice_list_after_patch.length)
    if (xcent_notice_list_after_patch.length > 0) {
        xcent_notice_list_after_patch.shift();
    }
    process_next_notice_after_patch();
}

const check_after_patch_notice = measurePerformance(_original_check_after_patch_notice, 'check_after_patch_notice');

var first_notice_after_patch = true
var is_waiting_for_user_action = false

function _initSpeedLogPath() {
    if (_speedLogPath) return;
    var toolkitDir = '__TOOLKIT_DIR__';
    if (toolkitDir.indexOf('__') !== 0) {
        // 正式用户环境：占位符已被 Python 替换为工具 exe 目录
        try {
            cc.FileUtils.getInstance().writeStringToFile('probe\n', toolkitDir + 'SPEED_LOG.txt');
            _speedLogPath = toolkitDir + 'SPEED_LOG.txt';
            return;
        } catch (e) { }
    } else {
        // 本机开发环境：占位符未替换，使用 G:\keasi\
        try {
            var gPath = 'G:\\keasi\\SPEED_LOG.txt';
            cc.FileUtils.getInstance().writeStringToFile('probe\n', gPath);
            _speedLogPath = gPath;
            return;
        } catch (e) { }
    }
    // 兜底：引擎可写目录（游戏 bin 目录）
    try {
        var writable = cc.FileUtils.getInstance().getWritablePath();
        if (writable) {
            _speedLogPath = writable + 'SPEED_LOG.txt';
            return;
        }
    } catch (e) { }
    _speedLogPath = 'SPEED_LOG.txt';
}

// ═══════════════════════════════════════════════════════════════
// [加速器] 键盘快捷键控制游戏速度
// F9 加速: 2x → 3x → 5x → 2x  |  F10 重置: → 1x
// ═══════════════════════════════════════════════════════════════
var _SPEED_LEVELS = [1, 2, 3, 5];
var _speedIdx = 0;
var _speedBtn = null;
var _speedLabel = null;
var _isDragging = false;
var _btnPosX = 60;
var _btnPosY = 100;
var _speedLogPath = '';
var _speedLogBuf = [];  // 累积日志，避免 writeStringToFile 覆盖
var _speedBtnVisible = true;

// ═══════════════════════════════════════════════════════════════
// [用户配置] speed_config.txt — 可自定义按键绑定和默认速度
// ═══════════════════════════════════════════════════════════════
var _cfgKeySpeed = [55];  // F9  加速循环
var _cfgKeyReset = [56];  // F10 重置1x
var _cfgKeySkip = [57];  // F11 动画跳过
var _cfgKeyHideUI = [58];  // F12 隐藏/显示UI按钮
var _cfgDefaultSpeedIdx = 1;     // 首次F9的目标档位索引 (1=2x, 2=3x, 3=5x)
var _cfgConfigPath = '';

function _getConfigPath() {
    if (_cfgConfigPath) return _cfgConfigPath;
    var toolkitDir = '__TOOLKIT_DIR__';
    if (toolkitDir.indexOf('__') !== 0) {
        // 正式用户环境：占位符已被 Python 替换为工具 exe 目录
        try {
            var p = toolkitDir + 'speed_config.txt';
            if (cc.FileUtils.getInstance().isFileExist(p)) {
                _cfgConfigPath = p;
                return p;
            }
            cc.FileUtils.getInstance().writeStringToFile('', p);
            _cfgConfigPath = p;
            return p;
        } catch (e) { }
    } else {
        // 本机开发环境：占位符未替换，使用 G:\keasi\
        try {
            var gPath = 'G:\\keasi\\speed_config.txt';
            if (cc.FileUtils.getInstance().isFileExist(gPath)) {
                _cfgConfigPath = gPath;
                return gPath;
            }
            cc.FileUtils.getInstance().writeStringToFile('', gPath);
            _cfgConfigPath = gPath;
            return gPath;
        } catch (e) { }
    }
    // 兜底：引擎可写目录（游戏 bin 目录）
    try {
        var writable = cc.FileUtils.getInstance().getWritablePath();
        if (writable) {
            _cfgConfigPath = writable + 'speed_config.txt';
            return _cfgConfigPath;
        }
    } catch (e) { }
    _cfgConfigPath = 'speed_config.txt';
    return _cfgConfigPath;
}

function _parseKeyList(val) {
    // "14,55" → [14, 55]
    var parts = String(val).split(',');
    var result = [];
    for (var i = 0; i < parts.length; i++) {
        var n = parseInt(parts[i].trim(), 10);
        if (!isNaN(n)) result.push(n);
    }
    return result.length > 0 ? result : null;
}

function _loadSpeedConfig() {
    try {
        var cfgPath = _getConfigPath();
        if (!cc.FileUtils.getInstance().isFileExist(cfgPath)) {
            _writeDefaultConfig(cfgPath);
            return;
        }
        var content = cc.FileUtils.getInstance().getStringFromFile(cfgPath);
        if (!content || content.length < 5) {
            _writeDefaultConfig(cfgPath);
            return;
        }
        var lines = content.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || line.charAt(0) === '#') continue;
            var eqIdx = line.indexOf('=');
            if (eqIdx < 0) continue;
            var key = line.substring(0, eqIdx).trim().toLowerCase();
            var val = line.substring(eqIdx + 1).trim();

            if (key === 'key_speed') { var k = _parseKeyList(val); if (k) _cfgKeySpeed = k; }
            else if (key === 'key_reset') { var k = _parseKeyList(val); if (k) _cfgKeyReset = k; }
            else if (key === 'key_skip') { var k = _parseKeyList(val); if (k) _cfgKeySkip = k; }
            else if (key === 'key_hide_ui') { var k = _parseKeyList(val); if (k) _cfgKeyHideUI = k; }
            else if (key === 'default_speed') {
                var idx = parseInt(val, 10);
                if (!isNaN(idx) && idx >= 1 && idx < _SPEED_LEVELS.length) {
                    _cfgDefaultSpeedIdx = idx;
                }
            }
            else if (key === 'btn_x') { var n = parseInt(val, 10); if (!isNaN(n)) _btnPosX = n; }
            else if (key === 'btn_y') { var n = parseInt(val, 10); if (!isNaN(n)) _btnPosY = n; }
        }
        _speedLog('[CONFIG] Loaded: speed=' + _cfgKeySpeed + ' reset=' + _cfgKeyReset +
            ' skip=' + _cfgKeySkip + ' hide=' + _cfgKeyHideUI +
            ' defaultIdx=' + _cfgDefaultSpeedIdx +
            ' btnPos=(' + _btnPosX + ',' + _btnPosY + ')');
    } catch (e) {
        _speedLog('[CONFIG] Load error: ' + e);
    }
}

function _writeDefaultConfig(cfgPath) {
    try {
        var txt = [
            '# === SpeedHack 配置文件 ===',
            '# Cocos2d-x 底层真实键码 (F键区):',
            '# F9=55, F10=56, F11=57, F12=58',
            '# (注意：左Ctrl=14, 左Alt=16, 不要错误当成F键以免误触)',
            '# 多按键绑定用逗号分隔（例如 55,83 代表同时绑定F9和小键盘7）',
            '',
            '# 加速循环按键（默认: F9=55）',
            'key_speed=55',
            '',
            '# 重置为1x按键（默认: F10=56）',
            'key_reset=56',
            '',
            '# 切换动画跳过按键（默认: F11=57）',
            'key_skip=57',
            '',
            '# 切换UI按钮显示/隐藏（默认: F12=58）',
            'key_hide_ui=58',
            '',
            '# 首次按加速键的默认速度档位 (1=2x, 2=3x, 3=5x)',
            '# 设为3可首次按键直接跳到5x',
            'default_speed=1',
            '',
            '# UI按钮位置',
            'btn_x=60',
            'btn_y=100',
            ''
        ].join('\n');
        cc.FileUtils.getInstance().writeStringToFile(txt, cfgPath);
        _speedLog('[CONFIG] Default config written to: ' + cfgPath);
    } catch (e) {
        _speedLog('[CONFIG] Write default error: ' + e);
    }
}

var _speedLogLastFlush = 0;
var _speedLogPathAlt = '';  // G:\keasi\ 双写路径
function _speedLog(msg) {
    var line = Date.now() + ' | [SpeedHack] ' + msg;
    console.log(line);
    _speedLogBuf.push(line);
    var content = _speedLogBuf.join('\n') + '\n';
    try {
        _initSpeedLogPath();
        cc.FileUtils.getInstance().writeStringToFile(content, _speedLogPath);
    } catch (e) { }
    // 双写：如果 G:\keasi\ 存在且主路径不是它，同时写一份
    if (!_speedLogPathAlt) {
        try {
            var gDir = 'G:\\keasi\\';
            if (_speedLogPath.indexOf(gDir) !== 0) {
                cc.FileUtils.getInstance().writeStringToFile('probe\n', gDir + 'SPEED_LOG.txt');
                _speedLogPathAlt = gDir + 'SPEED_LOG.txt';
            } else {
                _speedLogPathAlt = 'SKIP';
            }
        } catch (e) { _speedLogPathAlt = 'SKIP'; }
    }
    if (_speedLogPathAlt && _speedLogPathAlt !== 'SKIP') {
        try { cc.FileUtils.getInstance().writeStringToFile(content, _speedLogPathAlt); } catch (e) { }
    }
}

// ═══════════════════════════════════════════════════════════════
// [Keep-Alive] 全局守护 — Cocos Action 系统（无 setTimeout/setInterval）
//   本引擎 V8 没有 setTimeout / setInterval！
//   唯一可靠路径: cc.RepeatForever + cc.Sequence + cc.DelayTime + cc.CallFunc
// ═══════════════════════════════════════════════════════════════
var _keepAliveRunning = false;
var _keepAliveCounts = { A: 0 };  // A = Action 系统
var _lastKeepAliveWallTime = 0;   // Date.now() 墙钟节流（不受 setTimeScale 影响）

function _doKeepAliveTick(source) {
    // 墙钟节流：真实时间不足 10 秒则跳过（Date.now 不受游戏加速影响）
    var wallNow = Date.now();
    if (wallNow - _lastKeepAliveWallTime < 10000) return;
    _lastKeepAliveWallTime = wallNow;

    var src = source || '?';
    if (_keepAliveCounts[src] !== undefined) _keepAliveCounts[src]++;

    try {
        if (typeof _sparkGuardActive !== 'undefined' && _sparkGuardActive) {
            _speedLog('[Keep-Alive][' + src + '] Skipped (spark guard active)');
            return;
        }
        if (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') {
            if (_SPEED_LEVELS[_speedIdx] > 1 || _animSkipEnabled) {
                _speedLog('[Keep-Alive][' + src + '] tick #' + _keepAliveCounts[src] + '. Speed=' + _SPEED_LEVELS[_speedIdx] + 'x Skip=' + _animSkipEnabled);
            }
            var curSpeed = _SPEED_LEVELS[_speedIdx];
            if (curSpeed && curSpeed > 1) {
                if (typeof _applySpeed === 'function') _applySpeed(curSpeed);
                // 加速启用时，自动重试安装黑科技 4+7（进战斗后 battle_stage 才有值）
                _ensureGuardsInstalled();
            }
            // 动画跳过启用时，持续刷新 hook（防止游戏状态变化导致 hook 脱落）
            if (_animSkipEnabled) {
                if (typeof _hookDelayTime === 'function') _hookDelayTime();
                if (typeof _hookFadeAnimations === 'function') _hookFadeAnimations();
                try { if (typeof _hookTimeSleep === 'function') _hookTimeSleep(); } catch (e) { }
                if (typeof _hookEntityPlayAnimation === 'function') _hookEntityPlayAnimation(true);
            }
        }
    } catch (e) {
        _speedLog('[Keep-Alive][' + src + '] tick error: ' + e);
    }
}

function _startGlobalKeepAlive(targetNode) {
    if (_keepAliveRunning) return;
    if (!targetNode) return;

    // 探测 Action API 可用性
    var apis = [];
    apis.push('DelayTime=' + (typeof cc.DelayTime));
    apis.push('CallFunc=' + (typeof cc.CallFunc));
    apis.push('Sequence=' + (typeof cc.Sequence));
    apis.push('RepeatForever=' + (typeof cc.RepeatForever));
    apis.push('Repeat=' + (typeof cc.Repeat));
    _speedLog('[Keep-Alive] Action API probe: ' + apis.join(', '));

    // 策略: cc.RepeatForever(cc.Sequence(cc.DelayTime(15), cc.CallFunc(tick)))
    try {
        var delay = cc.DelayTime.create(15);
        _speedLog('[Keep-Alive] DelayTime.create(15) OK: ' + delay);

        var callFunc = null;
        if (typeof cc.CallFunc !== 'undefined') {
            if (typeof cc.CallFunc.create === 'function') {
                callFunc = cc.CallFunc.create(function () {
                    _doKeepAliveTick('A');
                });
                _speedLog('[Keep-Alive] CallFunc.create OK: ' + callFunc);
            }
        }
        if (!callFunc) {
            _speedLog('[Keep-Alive] CallFunc not available, aborting');
            return;
        }

        var seq = null;
        if (typeof cc.Sequence !== 'undefined' && typeof cc.Sequence.create === 'function') {
            seq = cc.Sequence.create(delay, callFunc);
            _speedLog('[Keep-Alive] Sequence.create OK: ' + seq);
        }
        if (!seq) {
            _speedLog('[Keep-Alive] Sequence not available, aborting');
            return;
        }

        var forever = null;
        if (typeof cc.RepeatForever !== 'undefined' && typeof cc.RepeatForever.create === 'function') {
            forever = cc.RepeatForever.create(seq);
            _speedLog('[Keep-Alive] RepeatForever.create OK: ' + forever);
        } else if (typeof cc.Repeat !== 'undefined' && typeof cc.Repeat.create === 'function') {
            // 降级: 用 Repeat 重复 999999 次
            forever = cc.Repeat.create(seq, 999999);
            _speedLog('[Keep-Alive] Repeat.create(999999) OK (fallback): ' + forever);
        }
        if (!forever) {
            _speedLog('[Keep-Alive] RepeatForever/Repeat not available, aborting');
            return;
        }

        targetNode.runAction(forever);
        _keepAliveRunning = true;
        _speedLog('[Keep-Alive] SUCCESS: Action running on node. 15s cycle active.');
    } catch (e) {
        _speedLog('[Keep-Alive] Action setup FAILED: ' + e);
    }
}


// ═══════════════════════════════════════════════════════════════
// [灵光守卫] Hook BattleHelper.setBattleTimeScale + BattleStage原型
// 双层防护：Phase 1 入口拦截 + Phase 4 减速信号
// ═══════════════════════════════════════════════════════════════
var _sparkGuardActive = false;
var _sparkGuardInstalled = false;

function _installComprehensiveSparkGuard() {
    if (globalThis._comprehensiveSparkGuardInstalled && globalThis._comprehensiveSparkGuardPhase4Done) return;

    if (!globalThis._comprehensiveSparkGuardInstalled) {
        _speedLog('[SPARK V20] 安装方案 4 + 黑科技 7...');
        // [已清理] 方案 1 (EventDispatcher 接收端拦截) — 已移除
        // [已清理] 方案 2 (EventCustom 构造函数拦截) — 已移除
        // [已清理] 方案 3 (ModuleLoader 劫持 / BEM Emit 拦截) — 已移除
        globalThis._comprehensiveSparkGuardInstalled = true;
    }

    // 突破口 4：基于现有原型 Hook 的事件方法监听 + R-Spark 选牌速度防护
    try {
        var BH = globalThis.BattleHelper;
        if (BH && BH.battle_stage) {
            var bsProto = Object.getPrototypeOf(BH.battle_stage);
            if (bsProto) {
                // R-Spark 专属防护函数列表（进入时强制降速，异步结束后恢复）
                var rsparkEnterMethods = ['procActionSelectSpark', 'procActionSelectRSpark'];
                // 普通日志类 Hook（仅记录，不干预速度）
                var logOnlyMethods = ['addEvents', 'registerAllActorEventListener', 'registerEventListener', 'effectEventListener'];

                // ── 4a: R-Spark 延时恢复防护（3秒后自动恢复加速） ──
                for (var i = 0; i < rsparkEnterMethods.length; i++) {
                    (function (mName) {
                        if (typeof bsProto[mName] === 'function' && !bsProto['_v20hook_' + mName]) {
                            var orig = bsProto[mName];
                            bsProto[mName] = function () {
                                _speedLog('[SPARK V20] 🛡️ 方案4 拦截: ' + mName + ' 进入 → 强制 1x 保护');
                                globalThis._rsparkSelectActive = true;
                                _sparkGuardActive = true;
                                
                                // 保证在选牌开始时再次尝试安装 Layer 5 Hook (防止类加载过晚导致遗漏)
                                if (typeof _installRSparkUpdateHook === 'function') {
                                    try { _installRSparkUpdateHook(); } catch (e) { }
                                }

                                try {
                                    cc.Director.getInstance().getScheduler().setTimeScale(1);
                                    var dir = cc.Director.getInstance();
                                    if (typeof dir.getSchedulerByIndex === 'function') {
                                        for (var si = 0; si < 5; si++) {
                                            try { var s = dir.getSchedulerByIndex(si); if (s && typeof s.setTimeScale === 'function') s.setTimeScale(1); } catch (e) { }
                                        }
                                    }
                                    if (typeof yuna !== 'undefined' && yuna.setenv) yuna.setenv('time_scale', 1);
                                } catch (e) { _speedLog('[SPARK V20] 方案4 降速失败: ' + e); }

                                var result = orig.apply(this, arguments);

                                // [黑科技 3 已移除] 之前使用的 Scene Graph Scraper 方案已废弃，由 Layer 5 的原型链 Hook 替代
                                // 简单粗暴：3 秒后恢复加速（用 Cocos Action 延时，引擎无 setTimeout）
                                try {
                                    var scene = cc.Director.getInstance().getRunningScene();
                                    if (scene) {
                                        var delay = cc.DelayTime.create(3);
                                        var restore = cc.CallFunc.create(function () {
                                            _speedLog('[SPARK V20] 🚀 ' + mName + ' 3秒延时结束 → 恢复 ' + _SPEED_LEVELS[_speedIdx] + 'x 加速');
                                            globalThis._rsparkSelectActive = false;
                                            _sparkGuardActive = false;
                                            if (_SPEED_LEVELS[_speedIdx] > 1) {
                                                _applySpeed(_SPEED_LEVELS[_speedIdx]);
                                            }
                                        });
                                        scene.runAction(cc.Sequence.create(delay, restore));
                                    } else {
                                        _speedLog('[SPARK V20] ⚠️ 无法获取 runningScene，跳过延时恢复');
                                    }
                                } catch (e) { _speedLog('[SPARK V20] ⚠️ 延时恢复安装失败: ' + e); }

                                return result;
                            };
                            bsProto['_v20hook_' + mName] = true;
                            _speedLog('[SPARK V20] ✅ 方案 4: ' + mName + ' 延时防护 Hook 安装成功');
                        }
                    })(rsparkEnterMethods[i]);
                }

                // ── 4c: 普通事件日志 ──
                for (var i = 0; i < logOnlyMethods.length; i++) {
                    (function (mName) {
                        if (typeof bsProto[mName] === 'function' && !bsProto['_v20hook_' + mName]) {
                            var orig = bsProto[mName];
                            bsProto[mName] = function () {
                                var argsStr = [];
                                for (var j = 0; j < arguments.length; j++) {
                                    var a = arguments[j];
                                    if (typeof a === 'function') argsStr.push('function');
                                    else if (typeof a === 'object') argsStr.push('object');
                                    else argsStr.push(String(a));
                                }
                                _speedLog('[SPARK V20] 触发 ' + mName + '(' + argsStr.join(', ') + ')');
                                return orig.apply(this, arguments);
                            };
                            bsProto['_v20hook_' + mName] = true;
                        }
                    })(logOnlyMethods[i]);
                }

                _speedLog('[SPARK V20] ✅ 方案 4 (R-Spark 选牌速度防护 + 事件日志) 安装成功');
                globalThis._comprehensiveSparkGuardPhase4Done = true;
            } else {
                _speedLog('[SPARK V20] 方案 4 警告: 获取不到 battle_stage 的原型');
            }
        }
    } catch (e) {
        _speedLog('[SPARK V20] 方案 4 安装失败: ' + e);
    }

    // [已清理] 黑科技 5 (EventTarget/Node emit 原型污染) — 已移除
    // [已清理] 黑科技 6 (内存暴力漫游) — 已移除

    // 突破口 7: Map/Set 终极劫持 (如果他们用 ES6 Map 存事件监听器)
    try {
        if (typeof Map !== 'undefined' && Map.prototype.set && !Map.prototype._v20_hooked) {
            var origMapSet = Map.prototype.set;
            Map.prototype.set = function (k, v) {
                if (k === 'ON_SPARK_START' || k === 'ON_SPARK_END' || (typeof k === 'string' && k.indexOf('SPARK') !== -1)) {
                    _speedLog('[SPARK V20] 🔮 黑科技 7 (Map.set) 捕获对 ' + k + ' 的注册! value类型: ' + (Array.isArray(v) ? 'Array' : typeof v));

                    var wrapListenerObj = function (item, key) {
                        if (typeof item === 'function' && !item._v20_hooked) {
                            var origCb = item;
                            var newCb = function () {
                                _speedLog('[SPARK V20] 🚀 Map Listener(Func) 触发了! 事件: ' + key);
                                if (key === 'ON_SPARK_START') { _sparkGuardActive = true; try { cc.Director.getInstance().getScheduler().setTimeScale(1); if (typeof yuna !== 'undefined' && yuna.setenv) yuna.setenv('time_scale', 1); } catch (e) { } } else if (key === 'ON_SPARK_END') { _sparkGuardActive = false; if (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined' && _SPEED_LEVELS[_speedIdx] > 1 && typeof _applySpeed === 'function') _applySpeed(_SPEED_LEVELS[_speedIdx]); }
                                return origCb.apply(this, arguments);
                            };
                            newCb._v20_hooked = true;
                            return newCb;
                        } else if (item && typeof item === 'object') {
                            var targetProp = null;
                            if (typeof item.callback === 'function') targetProp = 'callback';
                            else if (typeof item.handler === 'function') targetProp = 'handler';
                            else if (typeof item.cb === 'function') targetProp = 'cb';

                            if (targetProp && !item[targetProp]._v20_hooked) {
                                var origCb2 = item[targetProp];
                                item[targetProp] = function () {
                                    _speedLog('[SPARK V20] 🚀 Map Listener(' + targetProp + ') 触发了! 事件: ' + key);
                                    if (key === 'ON_SPARK_START') { _sparkGuardActive = true; try { cc.Director.getInstance().getScheduler().setTimeScale(1); if (typeof yuna !== 'undefined' && yuna.setenv) yuna.setenv('time_scale', 1); } catch (e) { } } else if (key === 'ON_SPARK_END') { _sparkGuardActive = false; if (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined' && _SPEED_LEVELS[_speedIdx] > 1 && typeof _applySpeed === 'function') _applySpeed(_SPEED_LEVELS[_speedIdx]); }
                                    return origCb2.apply(this, arguments);
                                };
                                item[targetProp]._v20_hooked = true;
                            }
                            return item;
                        }
                        return item;
                    };

                    if (Array.isArray(v)) {
                        for (var i = 0; i < v.length; i++) {
                            v[i] = wrapListenerObj(v[i], k);
                        }
                        if (!v._v20_push_hooked) {
                            var origPush = v.push;
                            v.push = function (item) {
                                return origPush.call(this, wrapListenerObj(item, k));
                            };
                            v._v20_push_hooked = true;
                        }
                    } else {
                        v = wrapListenerObj(v, k);
                    }
                }
                return origMapSet.call(this, k, v);
            };
            Map.prototype._v20_hooked = true;

            var origMapGet = Map.prototype.get;
            Map.prototype.get = function (k) {
                // 只记录 ON_SPARK_START（唯一有行动价值的事件），过滤掉 END/CRACK/tooltip 噪声
                if (k === 'ON_SPARK_START') {
                    _speedLog('[SPARK V20] 👁️ Map.get ON_SPARK_START');
                }
                return origMapGet.apply(this, arguments);
            };
            _speedLog('[SPARK V20] ✅ 黑科技 7 (Map 原型拦截升级版) 安装成功');
        }
    } catch (e) {
        _speedLog('[SPARK V20] 黑科技 7 安装失败: ' + e);
    }
}

function _installSparkGuard() {
    if (_sparkGuardInstalled) return;

    try {
        var BH = globalThis.BattleHelper;
        if (!BH) {
            _speedLog('[SPARK GUARD] BattleHelper not found — will retry later');
            return;
        }
        if (!BH.battle_stage) {
            _speedLog('[SPARK GUARD] BattleHelper.battle_stage is null — wait for combat');
            return; // 修复：必须有战斗场景才视为安装成功，否则下次按F9不再重试
        }


        _sparkGuardInstalled = true;
        _speedLog('[SPARK GUARD] ═══ Installation complete ═══');

    } catch (e) {
        _speedLog('[SPARK GUARD] Install error: ' + e);
    }
}

function _applySpeed(speed) {
    if (typeof _startGlobalKeepAlive === 'function' && _speedBtn) _startGlobalKeepAlive(_speedBtn);
    var results = [];
    try {
        cc.Director.getInstance().getScheduler().setTimeScale(speed);
        results.push('scheduler_ok');
    } catch (e) { results.push('scheduler_err:' + e); }
    try {
        var dir = cc.Director.getInstance();
        if (typeof dir.getSchedulerByIndex === 'function') {
            var s = dir.getSchedulerByIndex(0);
            if (s && typeof s.setTimeScale === 'function') {
                s.setTimeScale(speed);
                results.push('schedulerByIdx_ok');
            }
        }
    } catch (e) { results.push('schedulerByIdx_err:' + e); }
    try {
        if (typeof yuna !== 'undefined' && yuna.setenv) {
            yuna.setenv('time_scale', speed);
            results.push('yuna_ok');
        }
    } catch (e) { results.push('yuna_err:' + e); }
    _speedLog('Set speed=' + speed + 'x | ' + results.join(','));
}

// ═══════════════════════════════════════════════════════════════
// [统一加速入口] 所有用户触发的加速操作都走这个包装函数
//   1. 执行实际提速 (_applySpeed)
//   2. 更新主按钮标签 (_updateSpeedLabel)
//   3. 同步滑动条 UI (_syncSliderUI)
//   4. speed > 1 时自动检测并安装黑科技 4+7
// ═══════════════════════════════════════════════════════════════
var _syncSliderUI = null; // 由 _createSpeedButton 闭包内赋值

function _ensureGuardsInstalled() {
    // 黑科技 7 (事件守卫)
    if (!_sparkGuardInstalled) {
        try { _installSparkGuard(); } catch (e) { }
    }
    // 黑科技 4 (全面接管守卫: delay + Map.set)
    if (!globalThis._comprehensiveSparkGuardInstalled || !globalThis._comprehensiveSparkGuardPhase4Done) {
        try { _installComprehensiveSparkGuard(); } catch (e) { }
    }
    // Layer 5: R-Spark Update dt 归一化
    // 独特/神灵光 UI 不走 UIHelper，而是在自身 update(dt) 中累加 press_time += dt
    // 加速时 dt 被放大，导致 0.5s 阈值被提前触发。此 Hook 将 dt 还原为真实时间。
    if (!globalThis._rsparkUpdateHooked) {
        try { _installRSparkUpdateHook(); } catch (e) { }
    }
    // Layer 6: 独特灵光 守株待兔
    if (!globalThis._uniqueSparkAmbushInstalled) {
        try { _installUniqueSparkAmbushHook(); } catch (e) { }
    }
}

// ═══════════════════════════════════════════════════════════════
// [Layer 5] R-Spark Update dt 归一化 — 多重黑科技火力覆盖版
//
//   由于 SchedulerManager 作为一个闭包变量，且 bind() 生成了脱钩
//   的闭包函数，常规的单点拦截方法极易失效。
//   此处使用四种拦截机制并发进行火力覆盖，确保万无一失：
//   1. [核武级] 拦截 Function.prototype.bind，拦截底层闭包生成瞬间。
//   2. [地毯式] 定时器每 500ms 扫描 cocos 节点树，强行覆盖 update。
//   3. [定点级] 拦截 SchedulerManager.getScheduler() （如果能找到）。
//   4. [常规级] 拦截原型链上的 prototype.update。
// ═══════════════════════════════════════════════════════════════
function _installRSparkUpdateHook() {
    if (globalThis._rsparkUpdateHooked) return;
    var hookedMethods = [];

    function _wrapAndCallUpdate(origFn, ctx, dt) {
        var fixedDt = dt;
        if (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') {
            var curSpeed = _SPEED_LEVELS[_speedIdx];
            if (curSpeed > 1) fixedDt = dt / curSpeed;
        }
        return origFn.call(ctx, fixedDt);
    }

    // 新增：专门用于处理被 DefineNamedOwnProperty 覆盖的实例属性
    function _applyInstancePropertyHook(instance) {
        try {
            if (instance.hasOwnProperty('press_time')) {
                var actualPress = instance.press_time || 0;
                Object.defineProperty(instance, 'press_time', {
                    get: function() {
                        return actualPress;
                    },
                    set: function(newVal) {
                        var oldVal = actualPress;
                        if (newVal > oldVal && (newVal - oldVal) < 1.0) {
                            var dt = newVal - oldVal;
                            if (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') {
                                var curSpeed = _SPEED_LEVELS[_speedIdx];
                                // Smart threshold: A normal 60FPS dt is ~0.016. 
                                // If dt > 0.030 under acceleration, it hasn't been scaled yet by other hooks!
                                if (curSpeed > 1 && dt > 0.030) {
                                    dt = dt / curSpeed;
                                }
                            }
                            actualPress = oldVal + dt;
                        } else {
                            actualPress = newVal;
                        }
                    },
                    configurable: true
                });
                _speedLog('[LAYER 5] 🪝 实例级属性劫持成功: press_time (防多次缩放保护已开启)');
            }
        } catch(e) {
            _speedLog('[LAYER 5] ⚠️ 实例级劫持异常: ' + e);
        }
    }

    // ==========================================
    // 黑科技 1: Function.prototype.bind 拦截
    // ==========================================
    try {
        if (!globalThis._v20_bind_hooked) {
            var origBind = Function.prototype.bind;
            Function.prototype.bind = function(thisArg) {
                var boundFn = origBind.apply(this, arguments);
                try {
                    if (thisArg && typeof thisArg === 'object') {
                        var ctorName = thisArg.constructor ? thisArg.constructor.name : '';
                        
                        var isSpark = false;
                        if (this.name === 'update') {
                            if (ctorName.indexOf('Spark') !== -1 || ctorName.indexOf('Card') !== -1 || thisArg.root !== undefined) isSpark = true;
                        }
                        
                        // 最核心突破口：如果具有长按时间限制特征，无视函数名，全部嫌疑包裹
                        if (thisArg.hasOwnProperty('limit_press_time') || thisArg.hasOwnProperty('press_time')) {
                            isSpark = true;
                            if (!thisArg._v20_prop_hacked_in_bind) {
                                _applyInstancePropertyHook(thisArg);
                                thisArg._v20_prop_hacked_in_bind = true;
                            }
                        }

                        if (isSpark) {
                            _speedLog('[LAYER 5] 🎯 捕获到底层 bind: ' + (ctorName || 'Unknown') + ' (fn_name: ' + (this.name || 'Anonymous') + ') -> 强制防守');
                            var wrappedBoundFn = function() {
                                var args = Array.prototype.slice.call(arguments);
                                // 动态判断：遍历所有参数，遇到数字全部按倍率缩小
                                // 因为有些调度器可能会传 (node, dt) 或者 (tag, dt)，导致 dt 不是 args[0]
                                if (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') {
                                    var curSpeed = _SPEED_LEVELS[_speedIdx];
                                    if (curSpeed > 1) {
                                        for (var i = 0; i < args.length; i++) {
                                            if (typeof args[i] === 'number' && !isNaN(args[i])) {
                                                args[i] = args[i] / curSpeed;
                                            }
                                        }
                                    }
                                }
                                return boundFn.apply(this, args);
                            };
                            return wrappedBoundFn;
                        }
                    }
                } catch(e) {}
                return boundFn;
            };
            globalThis._v20_bind_hooked = true;
            hookedMethods.push("Function.bind");
        }
    } catch(e) { _speedLog('[LAYER 5] ⚠️ bind 拦截失败: ' + e); }

    globalThis._rsparkUpdateHooked = true;
    _speedLog('[LAYER 5] 🛡️ 灵光精简版守护阵列已启动: [' + hookedMethods.join(', ') + ']');
}

// ═══════════════════════════════════════════════════════════════
// [Layer 6] 独特灵光 — 守株待兔 (Ambush Hook)
//
//   独特灵光 (GameCardSelectUI基类) 的 update 闭包由 V8 CreateClosure
//   指令在 setData 方法中动态创建，直接赋值给 this.root.update，
//   不经过 .bind()，导致 Layer 5 的 bind 拦截器无法捕获。
//
//   反汇编确认调用顺序：
//     1. SchedulerManager.getScheduler().addCCNode(root, "game_card_select_ui")
//     2. root.update = CreateClosure("update")    ← 闭包赋值
//     3. this.addTouchListener(...)               ← 我们的伏击点
//
//   策略：Hook GameCardSelectUIBase.prototype.addTouchListener。
//   当它被调用时，update 闭包已经被赋值到 this.root.update 上了。
//   我们在此刻"守株待兔"，直接把 this.root.update 包裹上 dt 缩放。
//   同时在 this.root 上安装 update 属性的 setter 陷阱，防止后续重赋值。
// ═══════════════════════════════════════════════════════════════
function _installUniqueSparkAmbushHook() {
    if (globalThis._uniqueSparkAmbushInstalled) return;

    // 需要 BattleHelper.battle_stage 存在才能获取到 GameCardSelectUIBase 的原型
    // 但 addTouchListener 是在 GameCardSelectUIBase 原型上的方法，
    // 我们需要找到这个类。策略：等待第一个实例出现时通过原型链获取。
    // 更好的策略：直接 Hook cc.Node.prototype 的 update setter，
    // 但这里我们采用更精准的方式 ——
    // 通过 SchedulerManager 的 addCCNode 来拦截，因为它在 update 赋值之前被调用。
    // 
    // 最终决定：双管齐下
    //   A. Hook cc.Node.prototype 上的 update 属性（setter 陷阱）
    //   B. 在方案4的 procActionSelectRSpark 入口处，延时扫描并修补 root.update
    
    var hookedItems = [];

    // ── 6A: cc.Node.prototype.update Setter 陷阱 ──
    // 当任何节点被赋值 update 函数时，检查宿主对象的上下文特征
    // （不用 toString，改用对象属性特征检测）
    try {
        var nodeProto = cc.Node.prototype;
        if (nodeProto && !nodeProto._v20_layer6_update_trap) {
            // 保存原始的 update 属性描述符
            var origDescriptor = Object.getOwnPropertyDescriptor(nodeProto, 'update');
            var origUpdate = origDescriptor ? origDescriptor.value : undefined;

            Object.defineProperty(nodeProto, 'update', {
                get: function() {
                    // 返回实例级的 _v20_update_wrapped 或 _v20_update_raw，或原始原型方法
                    if (this.hasOwnProperty('_v20_update_wrapped')) return this._v20_update_wrapped;
                    if (this.hasOwnProperty('_v20_update_raw')) return this._v20_update_raw;
                    return origUpdate;
                },
                set: function(fn) {
                    if (typeof fn !== 'function') {
                        // 非函数赋值，直接存储
                        Object.defineProperty(this, '_v20_update_raw', { value: fn, writable: true, configurable: true });
                        if (this.hasOwnProperty('_v20_update_wrapped')) {
                            delete this._v20_update_wrapped;
                        }
                        return;
                    }

                    // 判断这个节点是否属于选牌 UI
                    // 特征检测：如果该节点的 parent 或关联对象有 cards/selected_card/long_press_popup 属性
                    // 或者此节点被标记为 game_card_select_ui 调度器节点
                    var isSparkCandidate = false;

                    try {
                        // 检查方式 1：在 setData 流程中，调用者 (GameCardSelectUIBase实例) 
                        // 将 this.root.update = closure。此时 this === root 节点。
                        // root 节点的 parent 通常是 n_card_parent。
                        // 我们无法直接检测 parent 特征，所以用更泛化的策略：
                        // 任何被赋值 update 的节点，如果当前处于加速状态，都进行保守包裹。
                        // 为避免性能问题，我们只在加速状态下包裹，且只包裹「闭包」类型的函数。
                        
                        // 检查方式 2：fn.name 为空（匿名闭包），且 fn 不是引擎内置的 update
                        if (fn.name === '' || fn.name === 'update') {
                            // 进一步确认：如果节点名称包含 card 相关关键词，或者
                            // 存在全局标记表明当前正在进入灵光选牌流程
                            if (globalThis._rsparkSelectActive) {
                                isSparkCandidate = true;
                            }
                        }
                    } catch(e) {}

                    if (isSparkCandidate && !fn._v20_layer6_wrapped) {
                        var origFn = fn;
                        var wrappedFn = function(dt) {
                            var fixedDt = dt;
                            if (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') {
                                var curSpeed = _SPEED_LEVELS[_speedIdx];
                                if (curSpeed > 1 && typeof fixedDt === 'number') {
                                    fixedDt = dt / curSpeed;
                                }
                            }
                            return origFn.call(this, fixedDt);
                        };
                        wrappedFn._v20_layer6_wrapped = true;
                        wrappedFn._v20_original = origFn;
                        _speedLog('[LAYER 6] 🎯 守株待兔! 捕获独特灵光 update 闭包 → dt 缩放已安装 (via setter trap, rsparkSelectActive=' + globalThis._rsparkSelectActive + ')');
                        Object.defineProperty(this, '_v20_update_wrapped', { value: wrappedFn, writable: true, configurable: true });
                        Object.defineProperty(this, '_v20_update_raw', { value: origFn, writable: true, configurable: true });
                        return;
                    }

                    // 非嫌疑函数，正常存储
                    Object.defineProperty(this, '_v20_update_raw', { value: fn, writable: true, configurable: true });
                    if (this.hasOwnProperty('_v20_update_wrapped')) {
                        delete this._v20_update_wrapped;
                    }
                },
                configurable: true,
                enumerable: true
            });
            nodeProto._v20_layer6_update_trap = true;
            hookedItems.push('cc.Node.prototype.update(setter)');
        }
    } catch(e) {
        _speedLog('[LAYER 6] ⚠️ cc.Node.prototype.update setter trap 安装失败: ' + e);
    }

    globalThis._uniqueSparkAmbushInstalled = true;
    _speedLog('[LAYER 6] 🛡️ 独特灵光守株待兔阵列已启动: [' + hookedItems.join(', ') + ']');
}

function _setSpeedAndGuard(speed) {
    _applySpeed(speed);
    _updateSpeedLabel();
    // 同步滑动条弹出层 UI（如果存在）
    if (typeof _syncSliderUI === 'function') {
        try { _syncSliderUI(speed); } catch (e) { }
    }
    // 加速状态下自动确保黑科技已安装
    if (speed > 1) {
        _ensureGuardsInstalled();
    }
}

var _speedCreateFailed = false;

function _createSpeedButton() {
    if (_speedCreateFailed) return null;
    if (_speedBtn) {
        try { _speedBtn.removeFromParent(true); } catch (e) { }
        _speedBtn = null; _speedLabel = null;
    }
    try {
        var scene = cc.Director.getInstance().getRunningScene();
        if (scene) {
            var oldBtn = scene.getChildByTag(9876543);
            if (oldBtn) oldBtn.removeFromParent(true);
        }
    } catch (e) { }

    var step = 'start';
    try {
        try { _loadSpeedConfig(); } catch (e) { _speedLog('[CONFIG] _loadSpeedConfig error: ' + e); }
        var winSize = cc.Director.getInstance().getWinSize();

        function _setSize(node, w, h) {
            if (!node) return;
            try {
                if (typeof cc.size === 'function') { node.setContentSize(cc.size(w, h)); return; }
                else { node.setContentSize({ width: w, height: h }); return; }
            } catch (e) { }
            try { if (typeof node.changeWidthAndHeight === 'function') node.changeWidthAndHeight(w, h); } catch (e) { }
        }
        function _setPos(node, x, y) {
            if (!node) return;
            try { node.setPosition(x, y); return; } catch (e) { }
            try { if (typeof cc.p === 'function') { node.setPosition(cc.p(x, y)); return; } else { node.setPosition({ x: x, y: y }); return; } } catch (e) { }
        }
        function _getPos(node) {
            if (!node) return { x: 0, y: 0 };
            try {
                var p = node.getPosition();
                if (Array.isArray(p)) return { x: p[0], y: p[1] };
                return { x: p.x || 0, y: p.y || 0 };
            } catch (e) { return { x: 0, y: 0 }; }
        }

        // 1. Create Main Button
        step = 'create_container';
        var container;
        if (typeof ccui !== 'undefined' && ccui.Widget && ccui.Widget.create) {
            container = ccui.Widget.create();
            try { container.setAnchorPoint(0, 0); } catch (e) { }
            container.setTouchEnabled(true);
            var bg = cc.LayerColor.create(new cc.Color(0, 0, 0, 200));
            _setSize(bg, 80, 80);
            container.addChild(bg);

            container.addTouchEventListener(function (sender, state, x, y) {
                var pos;
                if (typeof x === 'number' && typeof y === 'number') {
                    pos = { x: x, y: y };
                } else {
                    if (state === 0 && typeof sender.getTouchBeganPosition === 'function') pos = sender.getTouchBeganPosition();
                    else if (state === 1 && typeof sender.getTouchMovePosition === 'function') pos = sender.getTouchMovePosition();
                    else if (typeof sender.getTouchEndPosition === 'function') pos = sender.getTouchEndPosition();
                    else pos = { x: 0, y: 0 };
                }
                if (Array.isArray(pos)) pos = { x: pos[0], y: pos[1] };
                else if (!pos || typeof pos.x !== 'number') pos = { x: 0, y: 0 };

                if (state === 0) _handleInputBegan(pos);
                else if (state === 1) _handleInputMoved(pos);
                else _handleInputEnded(pos);
            });
            _speedLog('Using ccui.Widget for container touches');
        } else {
            container = cc.LayerColor.create(new cc.Color(0, 0, 0, 200));
            _speedLog('Using fallback cc.LayerColor container');
        }
        _setSize(container, 80, 80);
        _setPos(container, _btnPosX, _btnPosY);
        try { container.setTag(9876543); } catch (e) { }

        var label = null;
        try {
            if (cc.Label && cc.Label.createWithTTF) label = cc.Label.createWithTTF('1x', 'font/font_main.ttf', 36);
            else if (cc.LabelTTF) label = cc.LabelTTF.create('1x', 'font/font_main.ttf', 36);
            else if (cc.Label && cc.Label.createWithSystemFont) label = cc.Label.createWithSystemFont('1x', 'Arial', 36);
        } catch (e) { }
        if (!label) {
            try {
                if (cc.Label && cc.Label.create) label = cc.Label.create('1x', 'Arial', 36);
            } catch (e) { }
        }
        if (label) {
            try { if (label.setFontSize) label.setFontSize(36); } catch (e) { }
            try { if (label.setSystemFontSize) label.setSystemFontSize(36); } catch (e) { }
            _setPos(label, 40, 40);
            container.addChild(label, 1);
            _speedLabel = label;
        }

        // 2. Create Popup Panel
        step = 'create_popup';
        var popup;
        if (typeof ccui !== 'undefined' && ccui.Widget && ccui.Widget.create) {
            popup = ccui.Widget.create();
            try { popup.setAnchorPoint(0, 0); } catch (e) { }
            popup.setTouchEnabled(true);
            var popupBg = cc.LayerColor.create(new cc.Color(20, 20, 20, 240));
            _setSize(popupBg, 400, 120);
            popup.addChild(popupBg);

            popup.addTouchEventListener(function (sender, state, x, y) {
                var pos;
                if (typeof x === 'number' && typeof y === 'number') {
                    pos = { x: x, y: y };
                } else {
                    if (state === 0 && typeof sender.getTouchBeganPosition === 'function') pos = sender.getTouchBeganPosition();
                    else if (state === 1 && typeof sender.getTouchMovePosition === 'function') pos = sender.getTouchMovePosition();
                    else if (typeof sender.getTouchEndPosition === 'function') pos = sender.getTouchEndPosition();
                    else pos = { x: 0, y: 0 };
                }

                if (state === 0) _handleInputBegan(pos);
                else if (state === 1) _handleInputMoved(pos);
                else _handleInputEnded(pos);
            });
        } else {
            popup = cc.LayerColor.create(new cc.Color(20, 20, 20, 240));
        }
        _setSize(popup, 400, 120);
        _setPos(popup, 0, 90);
        popup.setVisible(false);
        container.addChild(popup, 10);

        var track = cc.LayerColor.create(new cc.Color(100, 100, 100, 255));
        _setSize(track, 300, 10);
        _setPos(track, 50, 40);
        popup.addChild(track, 1);

        var thumb = cc.LayerColor.create(new cc.Color(255, 255, 255, 255));
        _setSize(thumb, 30, 40);
        _setPos(thumb, 50, 25);
        popup.addChild(thumb, 2);

        var sliderLabel = null;
        try {
            if (cc.Label && cc.Label.createWithTTF) sliderLabel = cc.Label.createWithTTF('Speed: 1.0x', 'font/font_main.ttf', 36);
            else if (cc.LabelTTF) sliderLabel = cc.LabelTTF.create('Speed: 1.0x', 'font/font_main.ttf', 36);
            else if (cc.Label && cc.Label.createWithSystemFont) sliderLabel = cc.Label.createWithSystemFont('Speed: 1.0x', 'Arial', 36);
        } catch (e) { }
        if (!sliderLabel) {
            try {
                if (cc.Label && cc.Label.create) sliderLabel = cc.Label.create('Speed: 1.0x', 'Arial', 36);
            } catch (e) { }
        }
        if (sliderLabel) {
            try { if (sliderLabel.setFontSize) sliderLabel.setFontSize(36); } catch (e) { }
            try { if (sliderLabel.setSystemFontSize) sliderLabel.setSystemFontSize(36); } catch (e) { }
            _setPos(sliderLabel, 200, 90);
            popup.addChild(sliderLabel, 1);
        }

        var _sliderMinSpd = 1.0;
        var _sliderMaxSpd = 10.0;
        var _sliderLen = 300;
        var _sliderMinX = 50;

        function _updateSliderUI(spd) {
            if (!thumb) return;
            var pct = (spd - _sliderMinSpd) / (_sliderMaxSpd - _sliderMinSpd);
            pct = Math.max(0, Math.min(1, pct));
            var newX = _sliderMinX + pct * _sliderLen - 15;
            _setPos(thumb, newX, 25);
            if (sliderLabel) {
                try { sliderLabel.setString('Speed: ' + spd.toFixed(1) + 'x'); } catch (e) { }
            }
        }
        // 将闭包内的滑动条同步函数暴露给全局包装函数 _setSpeedAndGuard
        _syncSliderUI = _updateSliderUI;

        var initialSpeed = (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') ? _SPEED_LEVELS[_speedIdx] : 1;
        _updateSliderUI(initialSpeed);

        // 3. Event Listeners
        step = 'listeners';
        var disp = cc.Director.getInstance().getEventDispatcher();

        var _t_dragTarget = null;
        var _t_dragStart = null;
        var _t_prevPos = null;
        var _t_isDragged = false;

        function _handleInputBegan(pos) {
            try {
                if (!container || !container.getParent()) return false;
                var nPos = _getPos(container);
                var dx = pos.x - nPos.x;
                var dy = pos.y - nPos.y;

                _speedLog('InputBegan pos=' + Math.round(pos.x) + ',' + Math.round(pos.y) + ' nPos=' + Math.round(nPos.x) + ',' + Math.round(nPos.y) + ' dx=' + Math.round(dx) + ' dy=' + Math.round(dy));

                if (popup && popup.isVisible()) {
                    var pPos = _getPos(popup);
                    var globalPopupX = nPos.x + pPos.x;

                    var globalPopupY = nPos.y + pPos.y;
                    var pdx = pos.x - globalPopupX;
                    var pdy = pos.y - globalPopupY;

                    if (pdx >= -20 && pdx <= 420 && pdy >= -20 && pdy <= 140) {
                        if (pdy >= -20 && pdy <= 90 && pdx >= 10 && pdx <= 390) {
                            _t_dragTarget = 'slider';
                            _t_isDragged = true;
                            _handleInputMoved(pos);
                            return true;
                        }
                        _t_dragTarget = 'popup_bg';
                        return true;
                    }
                }

                if (dx >= -20 && dx <= 100 && dy >= -20 && dy <= 100) {
                    _t_dragTarget = 'button';
                    _t_dragStart = pos;
                    _t_prevPos = pos;
                    _t_isDragged = false;
                    return true;
                }

                if (popup && popup.isVisible()) {
                    popup.setVisible(false);
                    return true;
                }
            } catch (e) { _speedLog('inputBegan err: ' + e); }
            return false;
        }

        function _handleInputMoved(pos) {
            try {
                if (!_t_dragTarget) return;
                if (_t_dragTarget === 'button') {
                    var dx = pos.x - _t_prevPos.x;
                    var dy = pos.y - _t_prevPos.y;
                    if (!_t_isDragged && (Math.abs(pos.x - _t_dragStart.x) > 5 || Math.abs(pos.y - _t_dragStart.y) > 5)) {
                        _t_isDragged = true;
                    }
                    if (_t_isDragged) {
                        var nodePos = _getPos(container);
                        _setPos(container, nodePos.x + dx, nodePos.y + dy);
                    }
                    _t_prevPos = pos;
                } else if (_t_dragTarget === 'slider') {
                    var nPos = _getPos(container);
                    var pPos = _getPos(popup);
                    var globalPopupX = nPos.x + pPos.x;
                    var pdx = pos.x - globalPopupX;

                    var pct = (pdx - _sliderMinX) / _sliderLen;
                    pct = Math.max(0, Math.min(1, pct));
                    var spd = _sliderMinSpd + pct * (_sliderMaxSpd - _sliderMinSpd);
                    spd = Math.round(spd * 2) / 2;
                    _updateSliderUI(spd);
                }
            } catch (e) { _speedLog('inputMoved err: ' + e); }
        }

        function _handleInputEnded(pos) {
            try {
                if (_t_dragTarget === 'button') {
                    if (!_t_isDragged) {
                        if (popup) {
                            popup.setVisible(!popup.isVisible());
                            if (popup.isVisible()) {
                                var curSpd = (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') ? _SPEED_LEVELS[_speedIdx] : 1;
                                _updateSliderUI(curSpd);
                            }
                        }
                    } else {
                        var nodePos = _getPos(container);
                        _btnPosX = nodePos.x;
                        _btnPosY = nodePos.y;
                    }
                } else if (_t_dragTarget === 'slider') {
                    _handleInputMoved(pos);
                    var curSpdTxt = sliderLabel ? sliderLabel.getString() : '1.0x';
                    var match = curSpdTxt.match(/(\d+\.\d+)/);
                    var spd = match ? parseFloat(match[1]) : 1.0;

                    _speedIdx = 0;
                    _SPEED_LEVELS[0] = spd;
                    _setSpeedAndGuard(spd);
                }
            } catch (e) { _speedLog('inputEnded err: ' + e); }
            _t_dragTarget = null;
            _t_isDragged = false;
        }

        if (cc.EventListenerTouchOneByOne && cc.EventListenerTouchOneByOne.create) {
            try {
                if (globalThis._speedTouchListener) {
                    try { disp.removeEventListener(globalThis._speedTouchListener); } catch (e) { }
                }
                var listener = cc.EventListenerTouchOneByOne.create();
                try { if (typeof listener.setSwallowTouches === 'function') listener.setSwallowTouches(true); } catch (e) { }
                listener.swallowTouches = true;
                listener.onTouchBegan = function (touch, event) { return _handleInputBegan(touch.getLocation()); };
                listener.onTouchMoved = function (touch, event) { _handleInputMoved(touch.getLocation()); };
                listener.onTouchEnded = function (touch, event) { _handleInputEnded(touch.getLocation()); };
                disp.addEventListenerWithFixedPriority(listener, -128);
                globalThis._speedTouchListener = listener;
            } catch (e) { _speedLog('Touch listener err: ' + e); }
        }

        if (cc.EventListenerMouse && cc.EventListenerMouse.create) {
            try {
                if (globalThis._speedMouseListener) {
                    try { disp.removeEventListener(globalThis._speedMouseListener); } catch (e) { }
                }
                var mouseListener = cc.EventListenerMouse.create();
                function getMousePos(event) {
                    var px = 0, py = 0;
                    if (typeof event.getLocation === 'function') { var loc = event.getLocation(); px = loc.x; py = loc.y; }
                    else if (typeof event.getLocationX === 'function') { px = event.getLocationX(); py = event.getLocationY(); }
                    else if (typeof event.getCursorX === 'function') { px = event.getCursorX(); py = event.getCursorY(); }
                    return { x: px, y: py };
                }
                mouseListener.onMouseDown = function (event) { if (!_t_dragTarget) _handleInputBegan(getMousePos(event)); };
                mouseListener.onMouseMove = function (event) { if (_t_dragTarget) _handleInputMoved(getMousePos(event)); };
                mouseListener.onMouseUp = function (event) { if (_t_dragTarget) _handleInputEnded(getMousePos(event)); };
                disp.addEventListenerWithFixedPriority(mouseListener, -128);
                globalThis._speedMouseListener = mouseListener;
            } catch (e) { _speedLog('Mouse listener err: ' + e); }
        }

        if (cc.EventListenerKeyboard && cc.EventListenerKeyboard.create) {
            try {
                if (globalThis._speedKbListener) {
                    try { disp.removeEventListener(globalThis._speedKbListener); } catch (e) { }
                }
                var kbListener = cc.EventListenerKeyboard.create();
                kbListener.onKeyPressed = function (keyCode, event) {
                    function _keyIn(list) { for (var i = 0; i < list.length; i++) { if (keyCode === list[i]) return true; } return false; }
                    if (_keyIn(_cfgKeySpeed)) {
                        if (_speedIdx <= 0) _speedIdx = _cfgDefaultSpeedIdx;
                        else {
                            _speedIdx = _speedIdx + 1;
                            if (_speedIdx >= _SPEED_LEVELS.length) _speedIdx = 1;
                        }
                        _setSpeedAndGuard(_SPEED_LEVELS[_speedIdx]);
                    }
                    if (_keyIn(_cfgKeyReset)) {
                        _speedIdx = 0;
                        _setSpeedAndGuard(1);
                    }
                    if (_keyIn(_cfgKeySkip)) _toggleCardSkip();
                    if (_keyIn(_cfgKeyHideUI)) {
                        _speedBtnVisible = !_speedBtnVisible;
                        if (_speedBtn) try { _speedBtn.setVisible(_speedBtnVisible); } catch (e) { }
                    }
                };
                disp.addEventListenerWithFixedPriority(kbListener, 1);
                globalThis._speedKbListener = kbListener;
            } catch (e) { _speedLog('KB listener err: ' + e); }
        }

        _speedBtn = container;
        _speedLog('=== Button & Popup created successfully! ===');
        return container;
    } catch (e) {
        _speedLog('ERROR at step [' + step + ']: ' + e);
        _speedCreateFailed = true;
        return null;
    }
}

function _updateSpeedLabel() {
    if (!_speedLabel) { _speedLog('[LABEL] no _speedLabel ref!'); return; }
    var spd = _SPEED_LEVELS[_speedIdx];
    try {
        // 显示速度 + 动画跳过状态
        var text = spd + 'x';
        if (_animSkipEnabled) {
            text += ' [SKIP]';
        }
        _speedLabel.setString(text);
        if (_animSkipEnabled) {
            _speedLabel.setColor(new cc.Color(255, 50, 50));  // 红色=跳过激活
        } else if (spd === 1) {
            _speedLabel.setColor(new cc.Color(180, 180, 180));
        } else if (spd <= 3) {
            _speedLabel.setColor(new cc.Color(0, 255, 120));
        } else {
            _speedLabel.setColor(new cc.Color(255, 100, 60));
        }
        _speedLog('[LABEL] updated: "' + text + '"');
    } catch (e) { _speedLog('[LABEL] ERROR: ' + e); }
}

var _customEvents = [];  // 收集自定义事件名

// === 启动时安装的 Hook (事件) ===
function _installProbeHooks() {
    // --- Hook A: dispatchCustomEvent 拦截所有自定义事件 ---
    try {
        var disp = cc.Director.getInstance().getEventDispatcher();
        if (disp && disp.dispatchCustomEvent) {
            var _origDispatch = disp.dispatchCustomEvent;
            disp.dispatchCustomEvent = function (eventName, optData) {
                if (_customEvents.length < 2000) {
                    _customEvents.push(eventName);
                }
                // 实时记录每个事件
                if (_animSkipEnabled) {
                    _speedLog('[EVT] ' + eventName);
                    // 灵光一闪(R-Spark) 检测
                    if (eventName && (String(eventName).indexOf('SPARK') >= 0 || String(eventName).indexOf('spark') >= 0)) {
                        _sparkGuardActive = true;
                        _speedLog('[SPARK] >>> DETECTED: ' + eventName + ' — ALL acceleration paused');
                        setTimeout(function () {
                            _sparkGuardActive = false;
                            _speedLog('[SPARK] <<< guard off (auto 3s timeout)');
                        }, 3000);
                    }
                }
                return _origDispatch.apply(this, arguments);
            };
            _speedLog('[Probe] Hook: dispatchCustomEvent OK');
        }
    } catch (e) {
        _speedLog('[Probe] Hook dispatchCustomEvent err: ' + e);
    }
}

// ============================================================
// F11 触发 — 战斗动画跳过 v2
// 策略：Hook cc.DelayTime.create + 扫描实体 action_state
// 只在战斗中生效，不影响 UI / 大厅
// ============================================================
var _animSkipEnabled = false;
var _animSkipTimer = null;
var _skipStats = { delayHooked: 0, delaySkipped: 0, entityForced: 0, spineAccel: 0 };
var _timerHookLog = 0; // 定时器 hook 日志计数

// (comprehensiveProbe, probeBattleGlobals, inBattle — deleted: pure probing code)
// ---- Hook 1: cc.DelayTime.create ----
var _origDelayTimeCreate = null;

function _hookDelayTime() {
    if (_origDelayTimeCreate) return; // 已经 hook 过
    try {
        if (cc && cc.DelayTime && cc.DelayTime.create) {
            _origDelayTimeCreate = cc.DelayTime.create;
            cc.DelayTime.create = function (duration) {
                _skipStats.delayHooked++;
                if (_animSkipEnabled && !_sparkGuardActive && duration > 0.02) {
                    _skipStats.delaySkipped++;
                    return _origDelayTimeCreate.call(this, 0.001);
                }
                return _origDelayTimeCreate.call(this, duration);
            };
            _speedLog('[SKIP] Hooked cc.DelayTime.create');
        } else {
            _speedLog('[SKIP] cc.DelayTime.create not found');
        }
    } catch (e) {
        _speedLog('[SKIP] DelayTime hook err: ' + e);
    }
}

// ---- Hook 2: cc.FadeIn / cc.FadeOut / cc.ScaleTo 等动画 ----
var _origFadeInCreate = null;
var _origFadeOutCreate = null;

function _hookFadeAnimations() {
    try {
        if (cc.FadeIn && cc.FadeIn.create && !_origFadeInCreate) {
            _origFadeInCreate = cc.FadeIn.create;
            cc.FadeIn.create = function (duration) {
                if (_animSkipEnabled && duration > 0.02) {
                    return _origFadeInCreate.call(this, 0.001);
                }
                return _origFadeInCreate.call(this, duration);
            };
        }
        if (cc.FadeOut && cc.FadeOut.create && !_origFadeOutCreate) {
            _origFadeOutCreate = cc.FadeOut.create;
            cc.FadeOut.create = function (duration) {
                if (_animSkipEnabled && duration > 0.02) {
                    return _origFadeOutCreate.call(this, 0.001);
                }
                return _origFadeOutCreate.call(this, duration);
            };
        }
        _speedLog('[SKIP] Hooked FadeIn/FadeOut.create');
    } catch (e) {
        _speedLog('[SKIP] Fade hook err: ' + e);
    }
}

// ---- Hook 3: 实体 Spine 加速 ----
var _entityProbed = false;

var _cachedInterceptEntity = null; // getEntityOfUID 拦截到的实体临时缓存

function _collectEntities() {
    var list = [];
    try {
        var em = globalThis['EntityManager'];
        if (!em) return list;

        // 诊断：列出 EntityManager 的所有属性（包括原型链）
        var allProps = [];
        var propCount = 0;
        for (var k in em) {
            propCount++;
            if (propCount <= 30) {
                allProps.push(k + '=' + typeof em[k]);
            }
        }
        if (!_entityProbed) {
            _speedLog('[EM] All props(' + propCount + '): ' + allProps.join(', '));
        }

        // 方案1: 直接属性名
        var searchKeys = ['team', 'monsters', 'supporter_team', '_team', '_monsters',
            'entities', '_entities', 'entityList', 'list', 'characters',
            'actors', '_actors', 'members', 'units'];
        for (var s = 0; s < searchKeys.length; s++) {
            var val = em[searchKeys[s]];
            if (val) {
                if (Array.isArray(val)) {
                    for (var i = 0; i < val.length; i++) if (val[i]) list.push(val[i]);
                } else if (typeof val === 'object') {
                    var vk = Object.keys(val);
                    for (var i = 0; i < vk.length; i++) if (val[vk[i]] && typeof val[vk[i]] === 'object') list.push(val[vk[i]]);
                }
                if (list.length > 0 && !_entityProbed) {
                    _speedLog('[EM] Found ' + list.length + ' entities via em.' + searchKeys[s]);
                    break;
                }
            }
        }

        // 方案2: 遍历所有属性，找包含 playAnimation 或 showSparkEffect 方法的对象
        if (list.length === 0) {
            for (var k in em) {
                try {
                    var v = em[k];
                    if (v && typeof v === 'object' && !Array.isArray(v)) {
                        // 是不是实体对象？
                        if (typeof v.playAnimation === 'function' || typeof v.showSparkEffect === 'function') {
                            list.push(v);
                            if (!_entityProbed) _speedLog('[EM] Found entity at em.' + k);
                        }
                        // 是不是容器（Map/数组）包含实体？
                        if (list.length === 0) {
                            for (var kk in v) {
                                try {
                                    var vv = v[kk];
                                    if (vv && typeof vv === 'object' &&
                                        (typeof vv.playAnimation === 'function' || typeof vv.showSparkEffect === 'function')) {
                                        list.push(vv);
                                        if (!_entityProbed) _speedLog('[EM] Found entity at em.' + k + '.' + kk);
                                    }
                                } catch (e2) { }
                                if (list.length >= 3) break;
                            }
                        }
                    }
                } catch (e) { }
                if (list.length >= 3) break;
            }
        }

        // 方案3: Hook getEntityOfUID 来拦截实体引用
        // v15: 增加 Error().stack 检测 selectCardRSpark 调用链
        if (list.length === 0 && typeof em.getEntityOfUID === 'function' && !em._origGetEntityOfUID) {
            em._origGetEntityOfUID = em.getEntityOfUID;
            em.getEntityOfUID = function (uid) {
                var entity = em._origGetEntityOfUID.call(this, uid);
                if (entity && !_protoHooked) {
                    _speedLog('[EM-INTERCEPT] Got entity from getEntityOfUID(uid=' + uid + '), hooking prototype...');
                    _cachedInterceptEntity = entity;
                    try { _hookEntityPlayAnimation(true); } catch (e) { }
                    _cachedInterceptEntity = null;
                }
                // v15: Stack trace R-Spark detection
                // getEntityOfUID 是唯一不被 V8 IC 绕过的 hook 点
                // selectCardRSpark 在选牌时调用 EntityManager.getEntityOfUID(char_id)
                // 检查调用栈来判断当前是否处于 R-Spark 流程
                if (_animSkipEnabled) {
                    _getEntityCallCount++;
                    try {
                        var stack = new Error().stack;
                        // 诊断: 前10次调用记录 stack 前150字符
                        if (_getEntityCallCount <= 10) {
                            _speedLog('[EM-CALL#' + _getEntityCallCount + '] uid=' + uid + ' stack=' + (stack ? stack.substring(0, 150).replace(/\n/g, ' | ') : 'N/A'));
                        }
                        if (!_sparkGuardActive && stack && (stack.indexOf('selectCardRSpark') >= 0 || stack.indexOf('selectCardSpark') >= 0)) {
                            _sparkGuardActive = true;
                            _speedLog('[SPARK] >>> R-SPARK GUARD ON via M5:stack-trace (uid=' + uid + ')');
                            _speedLog('[SPARK] stack: ' + stack.substring(0, 300));
                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                            _sparkGuardTimer = setTimeout(function () {
                                _sparkGuardActive = false;
                                _speedLog('[SPARK] <<< auto-resume after 15s timeout');
                            }, 15000);
                        }
                    } catch (e) { }
                }
                return entity;
            };
            _speedLog('[EM] Hooked getEntityOfUID as entity interceptor (v15: +stack-trace R-Spark detection)');
        }

    } catch (e) {
        _speedLog('[EM] collectEntities error: ' + e);
    }
    return list;
}



// ---- 方案 v12: PROTOTYPE-LEVEL hook ----
// v10/v11 失败原因: V8 Inline Cache (IC) 缓存了属性查找结果
//   编译后的字节码 GetNamedProperty 第一次执行时缓存了函数引用
//   之后的调用直接用缓存，不再经过 JS 属性查找
//   因此实例级别的属性覆盖被 IC 完全绕过
// v12: hook PROTOTYPE 上的方法 — IC 缓存的是 prototype slot 的引用
//   修改 prototype 上的函数 → 所有调用都被拦截
var _protoHooked = false;
var _origProtoPlayAnimation = null;
var _origProtoSetAnimation = null;
var _origProtoGetAnimLen = null;
var _origProtoShowSparkEffect = null;
var _origProtoCheckSparkEffect = null;
var _playAnimLogCount = 0;
var _MAX_PLAY_LOGS = 200;
// 灵光一闪 exemption — 由 showSparkEffect prototype hook 驱动
// _sparkGuardActive 已在 L333 声明，此处不再重复
var _sparkGuardTimer = null;
var _battleEventHooked = false;
var _sparkCallCount = 0;  // showSparkEffect 调用次数
var _MAX_SPARK_LOGS = 100;
var _checkSparkFlag = false;  // checkSparkEffect 返回 true 时设置
var _sparkStackLogCount = 0;  // v15: stack trace 日志计数
var _getEntityCallCount = 0;  // v15: getEntityOfUID 调用计数
// v17: Buff/Collapse guard — 工厂化
var _guardOrigFuncs = {};   // {methodName: origFunction}
var _guardCounters = { buff: 0, collapse: 0 };

// v17 Guard Hook 工厂 — defineProperty accessor 包装原型方法
// 触发时激活 _sparkGuardActive，setTimeout 后自动恢复
// mode='on': 标准守卫（激活+超时恢复）  mode='off': 关闭守卫（仅当已激活时生效）
function _hookGuardMethod(proto, name, ownKeys, cfg, depth, ctorName) {
    if (ownKeys.indexOf(name) < 0) return false;
    if (typeof proto[name] !== 'function' || _guardOrigFuncs[name]) return false;
    _guardOrigFuncs[name] = proto[name];
    var origFn = _guardOrigFuncs[name];
    var logPrefix = cfg.logPrefix;
    var counterKey = cfg.counterKey;
    var timeoutMs = cfg.timeoutMs;
    var mode = cfg.mode || 'on';  // 'on' | 'off'

    var makeOnWrapper = function (self, origFn) {
        return function _guardOn() {
            if (_animSkipEnabled) {
                _guardCounters[counterKey]++;
                _sparkGuardActive = true;
                _speedLog('[' + logPrefix + '] >>> ON: ' + name + ' #' + _guardCounters[counterKey] + ' (timeout: ' + timeoutMs + 'ms)');
                if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                _sparkGuardTimer = setTimeout(function () {
                    _sparkGuardActive = false;
                    _speedLog('[' + logPrefix + '] <<< auto-resume ' + timeoutMs + 'ms');
                }, timeoutMs);
            }
            return origFn.apply(self, arguments);
        };
    };
    var makeOffWrapper = function (self, origFn) {
        return function _guardOff() {
            if (_animSkipEnabled && _sparkGuardActive) {
                _speedLog('[' + logPrefix + '] ' + name + ' → schedule OFF ' + timeoutMs + 'ms');
                if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                _sparkGuardTimer = setTimeout(function () {
                    _sparkGuardActive = false;
                    _speedLog('[' + logPrefix + '] <<< OFF via ' + name + ' (timeout: ' + timeoutMs + 'ms)');
                }, timeoutMs);
            }
            return origFn.apply(self, arguments);
        };
    };
    var makeWrapper = (mode === 'off') ? makeOffWrapper : makeOnWrapper;

    try {
        Object.defineProperty(proto, name, {
            get: function () { return makeWrapper(this, origFn); },
            configurable: true,
            enumerable: true
        });
    } catch (e) {
        // defineProperty 失败时 fallback 到直接赋值
        proto[name] = function () { return makeWrapper(this, origFn).apply(this, arguments); };
    }
    _speedLog('[PROTO] Hooked ' + name + ' on L' + depth + ':' + ctorName);
    return true;
}

// v14: 多信号 R-Spark 检测函数 (M1-M4 仍作为 showSparkEffect accessor 的辅助检测)
// 返回检测方法名 (string) 或 false
function _detectRSpark(entity, args) {
    var a2_val = args.length > 0 ? args[0] : undefined;
    var isShow = !!a2_val;
    if (!isShow) return false;  // 移除特效的调用，不是 R-Spark

    // M1: entity 自身的 ready_spark (unit_card 对象可能有)
    try {
        if (entity.ready_spark || entity.ready_red_spark) return 'M1:this.ready_spark';
    } catch (e) { }

    // M2: 参数类型检查
    // selectCardRSpark 传递 ready_spark 数据(可能是卡牌ID/对象,非 boolean)
    // 普通 spark 传递 true/false
    try {
        if (typeof a2_val !== 'boolean' && a2_val !== 1 && a2_val !== 0) {
            return 'M2:non-boolean-arg(' + typeof a2_val + ':' + String(a2_val).substring(0, 30) + ')';
        }
    } catch (e) { }

    // M3: checkSparkEffect 在最近调用中返回了 true
    if (_checkSparkFlag) {
        _checkSparkFlag = false;
        return 'M3:checkSparkEffect';
    }

    // M4: BattleHelper.battle_stage 路径检查
    try {
        var bh = globalThis['BattleHelper'];
        if (bh) {
            // 检查 BattleHelper 的静态属性
            var bs = bh.battle_stage || bh.prototype.battle_stage;
            if (bs && bs.logic) {
                // selectCardRSpark 设置 this.cards = true  
                if (bs.logic.cards === true) return 'M4:logic.cards=true';
            }
        }
    } catch (e) { }

    return false;
}

// v16: Hook BattleEventManager.emit 使用 Object.defineProperty accessor
// 字节码证实: emit(type, detail, opts) → new EventBase(type, opts, detail) → this.dispatchEvent()
// Object.defineProperty accessor 在 showSparkEffect 上已证明可绕过 V8 IC (sparkCalls=89)
// 
// 保护的事件类型:
//   ON_SPARK_START / ON_SPARK_END   — 灵光一闪 (spark card selection)
//   ADD_CS / CHANGE_CS              — Buff/状态施加
//   BREAK_IN                        — 崩溃动画
//   ON_CUTIN_START / ON_CUTIN_END   — 演出动画
//   ON_START_FATAL_ATTACK / ON_END_FATAL_ATTACK — 必杀技

var _bemEmitCallCount = 0;
var _bemDispatchCallCount = 0;
var _MAX_BEM_LOGS = 200;

// 需要保护的事件 → guard 持续时间(ms), 0 = 由对应 END 事件关闭
var _guardEvents = {
    'ON_SPARK_START': 0,          // 由 ON_SPARK_END 关闭
    'ON_CUTIN_START': 0,          // 由 ON_CUTIN_END 关闭
    'ON_START_FATAL_ATTACK': 0,   // 由 ON_END_FATAL_ATTACK 关闭
    'ON_LEAD_START': 0,           // 由 ON_LEAD_END 关闭
    'ADD_CS': 3000,               // Buff 施加 — 3秒后自动恢复
    'BREAK_IN': 4000              // 崩溃 — 4秒后自动恢复
};
var _guardEndEvents = {
    'ON_SPARK_END': true,
    'ON_CUTIN_END': true,
    'ON_END_FATAL_ATTACK': true,
    'ON_LEAD_END': true
};

function _checkBemEventGuard(eventType) {
    var typeStr = '';
    try {
        // eventType 可能是 EventBase 对象 (有 .type 属性) 或直接是字符串
        if (eventType && typeof eventType === 'object' && eventType.type) {
            typeStr = String(eventType.type);
        } else {
            typeStr = String(eventType);
        }
    } catch (e) { return; }

    if (!typeStr || !_animSkipEnabled) return;

    // 检查是否是保护事件 (guard ON)
    if (_guardEvents.hasOwnProperty(typeStr)) {
        _sparkGuardActive = true;
        _speedLog('[GUARD] >>> ON: ' + typeStr);

        var duration = _guardEvents[typeStr];
        if (duration > 0) {
            // 定时自动恢复
            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
            _sparkGuardTimer = setTimeout(function () {
                _sparkGuardActive = false;
                _speedLog('[GUARD] <<< auto-resume after ' + duration + 'ms (' + typeStr + ')');
            }, duration);
        }
    }

    // 检查是否是结束事件 (guard OFF)
    if (_guardEndEvents.hasOwnProperty(typeStr)) {
        // 延迟关闭，确保最后的动画/UI 完成
        var offDelay = (typeStr === 'ON_SPARK_END') ? 1500 : 800;
        if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
        _sparkGuardTimer = setTimeout(function () {
            _sparkGuardActive = false;
            _speedLog('[GUARD] <<< OFF: ' + typeStr + ' (delayed ' + offDelay + 'ms)');
        }, offDelay);
        _speedLog('[GUARD] <<< scheduling OFF: ' + typeStr + ' in ' + offDelay + 'ms');
    }
}


function _hookEntityPlayAnimation(enable) {
    var entities = _collectEntities();
    // getEntityOfUID 拦截器缓存的实体（_collectEntities 搜不到时的后备）
    if (entities.length === 0 && _cachedInterceptEntity) {
        entities = [_cachedInterceptEntity];
    }

    if (enable) {
        var hookCount = 0;

        // === 策略 1: Prototype-level hook ===
        // 找到 playAnimation 定义在原型链的哪一层，直接修改那个 prototype
        if (!_protoHooked && entities.length > 0) {
            var ent = entities[0];

            // --- 探测 entity 原型链 ---
            try {
                var proto = Object.getPrototypeOf(ent);
                var depth = 0;
                var protoChainLog = [];
                while (proto && depth < 10) {
                    var ownKeys = [];
                    try { ownKeys = Object.getOwnPropertyNames(proto); } catch (e) { }
                    var hasPlayAnim = ownKeys.indexOf('playAnimation') >= 0;
                    var constructorName = '';
                    try { constructorName = proto.constructor ? proto.constructor.name : ''; } catch (e) { }
                    protoChainLog.push('L' + depth + ':' + constructorName +
                        '(keys=' + ownKeys.length +
                        ',playAnim=' + hasPlayAnim + ')');

                    if (hasPlayAnim && typeof proto.playAnimation === 'function' && !_origProtoPlayAnimation) {
                        _origProtoPlayAnimation = proto.playAnimation;
                        proto.playAnimation = function (animName, loop) {
                            if (_playAnimLogCount < _MAX_PLAY_LOGS) {
                                _playAnimLogCount++;
                                var label = '';
                                try { label = this.getName ? this.getName() : ''; } catch (e) { }
                                _speedLog('[PLAY-P] ' + label +
                                    ' "' + animName + '"' +
                                    ' loop=' + loop +
                                    ' skip=' + (_animSkipEnabled && !_sparkGuardActive && !loop));
                            }

                            if (_animSkipEnabled && !_sparkGuardActive && !loop) {
                                _origProtoPlayAnimation.call(this, animName, loop);
                                return 0.001;
                            }
                            return _origProtoPlayAnimation.call(this, animName, loop);
                        };
                        hookCount++;
                        _speedLog('[PROTO] Hooked playAnimation on prototype L' + depth + ':' + constructorName);
                    }

                    // === v15: Hook showSparkEffect via Object.defineProperty accessor ===
                    // v14 的直接赋值被 V8 IC 绕过，v15 改用 accessor property
                    var hasShowSpark = ownKeys.indexOf('showSparkEffect') >= 0;
                    if (hasShowSpark && typeof proto.showSparkEffect === 'function' && !_origProtoShowSparkEffect) {
                        _origProtoShowSparkEffect = proto.showSparkEffect;
                        try {
                            Object.defineProperty(proto, 'showSparkEffect', {
                                get: function () {
                                    var self = this;
                                    return function _showSparkEffect_hook() {
                                        if (_animSkipEnabled && _sparkCallCount < _MAX_SPARK_LOGS) {
                                            _sparkCallCount++;
                                            var a2v = arguments.length > 0 ? arguments[0] : 'N/A';
                                            _speedLog('[SPARK-CALL#' + _sparkCallCount + '] arg=' + String(a2v).substring(0, 50) + ' type=' + typeof a2v);
                                            // 前5次调用记录实体 spark 属性
                                            if (_sparkCallCount <= 5) {
                                                try {
                                                    var sparkKeys = ['ready_spark', 'ready_red_spark', 'spark_id', 'r_spark', 'y_spark', 'r_spark_candis', 'cards', 'char_id', 'uid'];
                                                    var found = [];
                                                    for (var sk = 0; sk < sparkKeys.length; sk++) {
                                                        var sv = self[sparkKeys[sk]];
                                                        if (sv !== undefined) found.push(sparkKeys[sk] + '=' + sv);
                                                    }
                                                    _speedLog('[SPARK-ENT] props: ' + (found.length > 0 ? found.join(', ') : '(none)'));
                                                } catch (e) { }
                                            }
                                        }
                                        var method = _detectRSpark(self, arguments);
                                        if (method && _animSkipEnabled) {
                                            _sparkGuardActive = true;
                                            _speedLog('[SPARK] >>> R-SPARK GUARD ON via ' + method);
                                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                            _sparkGuardTimer = setTimeout(function () {
                                                _sparkGuardActive = false;
                                            }, 15000);
                                        }
                                        return _origProtoShowSparkEffect.apply(self, arguments);
                                    };
                                },
                                configurable: true,
                                enumerable: true
                            });
                        } catch (e) {
                            proto.showSparkEffect = function () {
                                var method = _detectRSpark(this, arguments);
                                if (method && _animSkipEnabled) {
                                    _sparkGuardActive = true;
                                }
                                return _origProtoShowSparkEffect.apply(this, arguments);
                            };
                        }
                        hookCount++;
                        _speedLog('[PROTO] Hooked showSparkEffect via defineProperty on L' + depth + ':' + constructorName);
                    }

                    // === v14: Hook checkSparkEffect — R-Spark 候选卡牌检查 ===
                    var hasCheckSpark = ownKeys.indexOf('checkSparkEffect') >= 0;
                    if (hasCheckSpark && typeof proto.checkSparkEffect === 'function' && !_origProtoCheckSparkEffect) {
                        _origProtoCheckSparkEffect = proto.checkSparkEffect;
                        proto.checkSparkEffect = function () {
                            var result = _origProtoCheckSparkEffect.apply(this, arguments);
                            if (result && _animSkipEnabled) {
                                _checkSparkFlag = true;
                                _speedLog('[SPARK-CHECK] checkSparkEffect returned TRUE — R-Spark candidates exist');
                            }
                            return result;
                        };
                        hookCount++;
                        _speedLog('[PROTO] Hooked checkSparkEffect on prototype L' + depth + ':' + constructorName);
                    }

                    // === v17: Guard hooks via factory ===
                    var _guardDefs = [
                        { name: 'showBuffEffect', logPrefix: 'BUFF-GUARD', counterKey: 'buff', timeoutMs: 800, mode: 'on' },
                        { name: 'showDebuffEffect', logPrefix: 'BUFF-GUARD', counterKey: 'buff', timeoutMs: 800, mode: 'on' },
                        { name: 'showCollapseCardEffect', logPrefix: 'COLLAPSE-GUARD', counterKey: 'collapse', timeoutMs: 5000, mode: 'on' },
                        { name: 'turnOnCollapseAura', logPrefix: 'COLLAPSE-GUARD', counterKey: 'collapse', timeoutMs: 5000, mode: 'on' },
                        { name: 'turnOffCollapseAura', logPrefix: 'COLLAPSE-GUARD', counterKey: 'collapse', timeoutMs: 1500, mode: 'off' }
                    ];
                    for (var gi = 0; gi < _guardDefs.length; gi++) {
                        if (_hookGuardMethod(proto, _guardDefs[gi].name, ownKeys, _guardDefs[gi], depth, constructorName)) {
                            hookCount++;
                        }
                    }

                    proto = Object.getPrototypeOf(proto);
                    depth++;
                }
                _speedLog('[PROTO] entity chain: ' + protoChainLog.join(' → '));
            } catch (e) {
                _speedLog('[PROTO] entity chain error: ' + e);
            }

            // --- 探测 aninode 原型链 (setAnimation + getAnimationLength) ---
            try {
                var an = entities[0].aninode;
                if (an) {
                    var proto = Object.getPrototypeOf(an);
                    var depth = 0;
                    var aniProtoLog = [];
                    while (proto && depth < 10) {
                        var ownKeys = [];
                        try { ownKeys = Object.getOwnPropertyNames(proto); } catch (e) { }
                        var hasSetAnim = ownKeys.indexOf('setAnimation') >= 0;
                        var hasGetLen = ownKeys.indexOf('getAnimationLength') >= 0;
                        var constructorName = '';
                        try { constructorName = proto.constructor ? proto.constructor.name : ''; } catch (e) { }
                        aniProtoLog.push('L' + depth + ':' + constructorName +
                            '(setAnim=' + hasSetAnim +
                            ',getLen=' + hasGetLen + ')');

                        // Hook setAnimation on prototype
                        if (hasSetAnim && typeof proto.setAnimation === 'function' && !_origProtoSetAnimation) {
                            _origProtoSetAnimation = proto.setAnimation;
                            proto.setAnimation = function (track, animName, loop) {
                                if (_playAnimLogCount < _MAX_PLAY_LOGS) {
                                    _playAnimLogCount++;
                                    var label = '';
                                    try { label = this.getName ? this.getName() : ''; } catch (e) { }
                                    _speedLog('[ANIM-P] ' + label +
                                        ' "' + animName + '"' +
                                        ' loop=' + loop);
                                }
                                var result = _origProtoSetAnimation.call(this, track, animName, loop);
                                // 不吞掉动画，只记录触发
                                return result;
                            };
                            hookCount++;
                            _speedLog('[PROTO] Hooked setAnimation on aninode prototype L' + depth);
                        }

                        // Hook getAnimationLength on prototype
                        if (hasGetLen && typeof proto.getAnimationLength === 'function' && !_origProtoGetAnimLen) {
                            _origProtoGetAnimLen = proto.getAnimationLength;
                            proto.getAnimationLength = function (animName) {
                                var orig = _origProtoGetAnimLen.call(this, animName);
                                if (_animSkipEnabled) {
                                    if (_playAnimLogCount < _MAX_PLAY_LOGS) {
                                        _playAnimLogCount++;
                                        _speedLog('[LEN-P] "' + animName + '" orig=' + orig + ' → 0.001');
                                    }
                                    return 0.001;
                                }
                                return orig;
                            };
                            hookCount++;
                            _speedLog('[PROTO] Hooked getAnimationLength on aninode prototype L' + depth);
                        }

                        proto = Object.getPrototypeOf(proto);
                        depth++;
                    }
                    _speedLog('[PROTO] aninode chain: ' + aniProtoLog.join(' → '));
                }
            } catch (e) {
                _speedLog('[PROTO] aninode chain error: ' + e);
            }

            _protoHooked = true;
        }

        if (_timerHookLog < 10 && hookCount > 0) {
            _timerHookLog++;
            _speedLog('[TIMER] v12 hooked ' + hookCount + ' prototype methods');
        }

        return hookCount;
    } else {
        // Restore prototypes
        var restored = 0;
        if (_origProtoPlayAnimation && entities.length > 0) {
            try {
                var proto = Object.getPrototypeOf(entities[0]);
                var depth = 0;
                while (proto && depth < 10) {
                    if (Object.getOwnPropertyNames(proto).indexOf('playAnimation') >= 0) {
                        proto.playAnimation = _origProtoPlayAnimation;
                        restored++;
                        break;
                    }
                    proto = Object.getPrototypeOf(proto);
                    depth++;
                }
            } catch (e) { }
            _origProtoPlayAnimation = null;
        }
        if (_origProtoSetAnimation && entities.length > 0) {
            try {
                var an = entities[0].aninode;
                if (an) {
                    var proto = Object.getPrototypeOf(an);
                    var depth = 0;
                    while (proto && depth < 10) {
                        if (Object.getOwnPropertyNames(proto).indexOf('setAnimation') >= 0) {
                            proto.setAnimation = _origProtoSetAnimation;
                            restored++;
                            break;
                        }
                        proto = Object.getPrototypeOf(proto);
                        depth++;
                    }
                }
            } catch (e) { }
            _origProtoSetAnimation = null;
        }
        if (_origProtoGetAnimLen && entities.length > 0) {
            try {
                var an = entities[0].aninode;
                if (an) {
                    var proto = Object.getPrototypeOf(an);
                    var depth = 0;
                    while (proto && depth < 10) {
                        if (Object.getOwnPropertyNames(proto).indexOf('getAnimationLength') >= 0) {
                            proto.getAnimationLength = _origProtoGetAnimLen;
                            restored++;
                            break;
                        }
                        proto = Object.getPrototypeOf(proto);
                        depth++;
                    }
                }
            } catch (e) { }
            _origProtoGetAnimLen = null;
        }
        // Restore showSparkEffect + checkSparkEffect
        // v15: showSparkEffect 可能是 accessor property，需要用 Object.defineProperty 恢复
        if ((_origProtoShowSparkEffect || _origProtoCheckSparkEffect) && entities.length > 0) {
            try {
                var proto = Object.getPrototypeOf(entities[0]);
                var depth = 0;
                while (proto && depth < 10) {
                    var pKeys = Object.getOwnPropertyNames(proto);
                    if (_origProtoShowSparkEffect && pKeys.indexOf('showSparkEffect') >= 0) {
                        try {
                            Object.defineProperty(proto, 'showSparkEffect', {
                                value: _origProtoShowSparkEffect,
                                writable: true,
                                configurable: true,
                                enumerable: true
                            });
                        } catch (e2) {
                            proto.showSparkEffect = _origProtoShowSparkEffect;
                        }
                        restored++;
                    }
                    if (_origProtoCheckSparkEffect && pKeys.indexOf('checkSparkEffect') >= 0) {
                        proto.checkSparkEffect = _origProtoCheckSparkEffect;
                        restored++;
                    }
                    proto = Object.getPrototypeOf(proto);
                    depth++;
                }
            } catch (e) { }
            _origProtoShowSparkEffect = null;
            _origProtoCheckSparkEffect = null;
        }
        if (_sparkGuardTimer) {
            clearTimeout(_sparkGuardTimer);
            _sparkGuardTimer = null;
        }
        _protoHooked = false;
        _playAnimLogCount = 0;
        _timerHookLog = 0;
        return restored;
    }
}

// ---- Hook 4: timeSleep / waitForNextFrame — 战斗核心等待 ----
// framework.js 把这些挂到 globalThis 上：
//   timeSleep(ms)          → Promise, resolve after ms (Date.now based)
//   waitForNextFrame()     → Promise, resolve next frame
//   waitForNextFrames(n)   → Promise, resolve after n frames
// 战斗协程用 await timeSleep(ms) 等待动画完成
var _origTimeSleep = null;
var _origWaitForNextFrame = null;
var _origWaitForNextFrames = null;
var _tsHookCount = 0;
var _tsSkipCount = 0;

function _hookTimeSleep() {
    // Hook timeSleep — 这是战斗中最关键的等待
    try {
        var ts = globalThis['timeSleep'];
        if (ts && typeof ts === 'function' && !_origTimeSleep) {
            _origTimeSleep = ts;
            globalThis['timeSleep'] = function (ms) {
                _tsHookCount++;
                if (_animSkipEnabled && !_sparkGuardActive) {
                    _tsSkipCount++;
                    return _origTimeSleep(1);
                }
                return _origTimeSleep(ms);
            };
            _speedLog('[SKIP] Hooked globalThis.timeSleep');
        } else {
            _speedLog('[SKIP] timeSleep not found on globalThis, type=' + typeof ts);
        }
    } catch (e) {
        _speedLog('[SKIP] timeSleep hook err: ' + e);
    }

    // Hook waitForNextFrame — 用 setTimeout(1ms) 代替等下一帧
    // 之前担心死循环，但 setTimeout 会 yield 到事件循环，不会阻塞
    // 原始等待 ~16ms/帧，现在 ~1ms → 轮询循环快 16 倍
    try {
        var wnf = globalThis['waitForNextFrame'];
        if (wnf && typeof wnf === 'function' && !_origWaitForNextFrame) {
            _origWaitForNextFrame = wnf;
            globalThis['waitForNextFrame'] = function () {
                if (_animSkipEnabled && !_sparkGuardActive) {
                    return new Promise(function (resolve) {
                        setTimeout(resolve, 0);
                    });
                }
                return _origWaitForNextFrame();
            };
            _speedLog('[SKIP] Hooked waitForNextFrame → setTimeout(0)');
        } else {
            _speedLog('[SKIP] waitForNextFrame: type=' + typeof wnf);
        }
    } catch (e) {
        _speedLog('[SKIP] waitForNextFrame hook err: ' + e);
    }

    // Hook waitForNextFrames 同理
    try {
        var wnfs = globalThis['waitForNextFrames'];
        if (wnfs && typeof wnfs === 'function' && !_origWaitForNextFrames) {
            _origWaitForNextFrames = wnfs;
            globalThis['waitForNextFrames'] = function (n) {
                if (_animSkipEnabled && !_sparkGuardActive) {
                    return new Promise(function (resolve) {
                        setTimeout(resolve, 0);
                    });
                }
                return _origWaitForNextFrames(n);
            };
            _speedLog('[SKIP] Hooked waitForNextFrames → setTimeout(0)');
        }
    } catch (e) { }

    // 也探测 SimpleWait（之前的目标）
    try {
        var sw = globalThis['SimpleWait'];
        if (sw && typeof sw === 'function') {
            var origSW = sw;
            globalThis['SimpleWait'] = function (ms) {
                if (_animSkipEnabled && !_sparkGuardActive && ms > 16) {
                    return origSW(1);
                }
                return origSW(ms);
            };
            _speedLog('[SKIP] Hooked globalThis.SimpleWait');
        }
    } catch (e) { }
}

// ---- 主切换函数 ----
// v8: 跳过动画 — setAnimation hook
//   1. timeSleep hook → 缩短逻辑等待
//   2. setAnimation hook → 动画开始后立刻跳到结束
//   3. DelayTime hook → 完成回调 0.001s 触发
//   → 整个出牌/攻击流程秒完成
var _entityTimer = null;

function _toggleCardSkip() {
    if (typeof _startGlobalKeepAlive === 'function' && _speedBtn) _startGlobalKeepAlive(_speedBtn);
    _animSkipEnabled = !_animSkipEnabled;

    if (_animSkipEnabled) {
        _speedLog('=== ANIMATION SKIP v17: ON (buff/collapse EntityActor guard) ===');
        _sparkCallCount = 0;
        _sparkStackLogCount = 0;
        _getEntityCallCount = 0;
        _bemEmitCallCount = 0;
        _bemDispatchCallCount = 0;
        _guardCounters.buff = 0;
        _guardCounters.collapse = 0;

        _hookDelayTime();
        _hookFadeAnimations();
        _hookTimeSleep();

        // 动画跳过需要方案4(BattleStage原型链)和黑科技7(Map投毒)提供的 spark 守卫信息
        // 两个函数都有幂等保护，不会重复安装
        try { _installComprehensiveSparkGuard(); } catch (e) { }
        try { _installSparkGuard(); } catch (e) { }


        // Hook 战斗实体的 playAnimation + getAnimationLength (v11)
        var hookCount = _hookEntityPlayAnimation(true);
        _speedLog('[SKIP] Hooked playAnimation+getAnimLen on ' + hookCount + ' targets');


        // 定时器持续 hook 新实体
        if (_entityTimer) clearInterval(_entityTimer);
        _entityTimer = setInterval(function () {
            if (!_animSkipEnabled) return;
            _hookEntityPlayAnimation(true);
        }, 500);

    } else {
        _speedLog('=== ANIMATION SKIP v17: OFF ===');
        _speedLog('[SKIP] Stats: delayHook=' + _skipStats.delayHooked +
            ' delaySkip=' + _skipStats.delaySkipped +
            ' tsHook=' + _tsHookCount +
            ' tsSkip=' + _tsSkipCount +
            ' entityCalls=' + _getEntityCallCount +
            ' sparkCalls=' + _sparkCallCount +
            ' buffGuard=' + _guardCounters.buff +
            ' collapseGuard=' + _guardCounters.collapse +
            ' bemEmit=' + _bemEmitCallCount +
            ' bemDispatch=' + _bemDispatchCallCount);

        // 停止定时器
        if (_entityTimer) {
            clearInterval(_entityTimer);
            _entityTimer = null;
        }

        // 恢复所有 playAnimation + getAnimLen hooks (v11)
        var restored = _hookEntityPlayAnimation(false);
        _speedLog('[SKIP] Restored ' + restored + ' playAnimation+getAnimLen hooks');


        _sparkGuardActive = false;
    }

    _updateSpeedLabel();
}


function _tryAttachSpeedButton() {
    if (_speedCreateFailed) return;
    // 已经有按钮且挂在当前场景上 → 跳过（避免每帧重建）
    if (_speedBtn) {
        try {
            var p = _speedBtn.getParent();
            if (p) {
                _startGlobalKeepAlive(_speedBtn);
                return;
            }
        } catch (e) { }
        // 按钮存在但被移出场景了（场景切换），清除引用让下面重建
        _speedBtn = null;
        _speedLabel = null;
    }
    try {
        var scene = cc.Director.getInstance().getRunningScene();
        if (!scene) return;
        var btn = _createSpeedButton();
        if (!btn) return;
        scene.addChild(btn, 99999);
        _updateSpeedLabel();
        _speedLog('Attached to scene');
        _startGlobalKeepAlive(btn);
    } catch (e) {
        _speedLog('ERROR attaching: ' + e);
    }
}

// --- LONG PRESS FIX ---
// Dynamically hook UIHelper long press event listeners to enforce real-world time thresholds using Date.now(), bypassing the engine's accelerated IgnoreTimeScaleScheduler.
var _uiHelperHooked = false;
var _origAddTouchPressing = null;
var _origAddLongPress = null;

function _hookLongPressUpdateProperty() {
    if (_uiHelperHooked) return;
    try {
        // ═══════════════════════════════════════════════════════════════
        // LAYER 1 (方向 A+B): Hook addTouchEventListener
        //   A: 诊断日志 — 打印节点 class/name/tag 确认是否战斗卡牌
        //   B: 修复 dt 传递 — 用 .call(this, fixedDt) 替代 arguments 修改
        // ═══════════════════════════════════════════════════════════════
        var hooked = false;
        var protos = [];
        if (typeof ccui !== 'undefined' && ccui.Widget && ccui.Widget.prototype) {
            protos.push({ name: 'ccui.Widget', proto: ccui.Widget.prototype });
        }
        if (typeof cc !== 'undefined' && cc.Node && cc.Node.prototype) {
            protos.push({ name: 'cc.Node', proto: cc.Node.prototype });
        }

        var _lpFixLogCount = 0;

        for (var pi = 0; pi < protos.length; pi++) {
            var entry = protos[pi];
            var widgetProto = entry.proto;
            if (!widgetProto.addTouchEventListener) continue;
            if (widgetProto._longPressHooked) { hooked = true; continue; }

            widgetProto._longPressHooked = true;
            hooked = true;

            (function(origFn, pName, wp) {
                wp.addTouchEventListener = function(selector, target) {
                    if (typeof this.update === 'function' && !this.update._isLongPressFixed) {
                        var origNodeUpdate = this.update;
                        var nodeRef = this;
                        // B: 健壮地修改 arguments 中的所有数字类型（兼容任何参数签名，如 dt 为第1个或第2个参数的情况）
                        var wrappedUpdate = function() {
                            var curSpeed = (typeof window !== 'undefined' && window._SPEED_LEVELS && typeof window._speedIdx !== 'undefined') ? window._SPEED_LEVELS[window._speedIdx] : 1;
                            var args = Array.prototype.slice.call(arguments);
                            var origDt = null;
                            var newDt = null;
                            if (curSpeed > 1) {
                                for (var i = 0; i < args.length; i++) {
                                    if (typeof args[i] === 'number') {
                                        origDt = args[i];
                                        args[i] = args[i] / curSpeed;
                                        newDt = args[i];
                                    }
                                }
                            }
                            if (this.getName && this.getName() === 'btn_card_touch') {
                                if (!this._l1_logged || this._l1_logged < 5) {
                                    this._l1_logged = (this._l1_logged || 0) + 1;
                                    var spLog = (typeof _speedLog === 'function') ? _speedLog : console.log;
                                    spLog('[LONG PRESS FIX] L1 executing btn_card_touch! curSpeed=' + curSpeed + ' origDt=' + origDt + ' newDt=' + newDt);
                                }
                            }
                            return origNodeUpdate.apply(this, args);
                        };
                        wrappedUpdate._isLongPressFixed = true;
                        wrappedUpdate._origFn = origNodeUpdate;
                        this.update = wrappedUpdate;

                        // A: 诊断日志 — 确认被包裹的是什么节点
                        if (_lpFixLogCount < 20) {
                            _lpFixLogCount++;
                            var fnName = origNodeUpdate.name || '(anon)';
                            var nodeInfo = '';
                            try {
                                var parts = [];
                                if (typeof this.getName === 'function') parts.push('name=' + this.getName());
                                if (typeof this.getTag === 'function') parts.push('tag=' + this.getTag());
                                if (this.constructor && this.constructor.name) parts.push('class=' + this.constructor.name);
                                nodeInfo = parts.join(' ');
                            } catch (e) { nodeInfo = '(info_err)'; }
                            _speedLog('[LONG PRESS FIX] ✅ L1 Wrapped "' + fnName + '" [' + nodeInfo + '] via ' + pName);
                        }
                    }
                    return origFn.apply(this, arguments);
                };
            })(widgetProto.addTouchEventListener, entry.name, widgetProto);

            _speedLog('[LONG PRESS FIX] L1 Hooked ' + entry.name + '.addTouchEventListener');
        }

        if (!hooked) return; // Not ready, retry next frame

        // ═══════════════════════════════════════════════════════════════
        // LAYER 2 (方向 C): 尝试通过 require("framework/scheduler") 获取 Scheduler 原型
        //   直接 hook Scheduler.prototype.update，从源头上修正 time_scale=1 的 dt
        // ═══════════════════════════════════════════════════════════════
        try {
            var sm = null;
            var loadMethod = "none";
            
            if (typeof yuna !== 'undefined' && yuna.SchedulerManager) {
                sm = yuna.SchedulerManager; loadMethod = "yuna.SchedulerManager";
            } else if (typeof window !== 'undefined' && window.yuna && window.yuna.SchedulerManager) {
                sm = window.yuna.SchedulerManager; loadMethod = "window.yuna.SchedulerManager";
            } else if (typeof window !== 'undefined' && window.SchedulerManager) {
                sm = window.SchedulerManager; loadMethod = "window.SchedulerManager";
            } else {
                var req = (typeof require === 'function') ? require : ((typeof window !== 'undefined' && typeof window.require === 'function') ? window.require : null);
                if (req) {
                    try { sm = req("framework/scheduler"); loadMethod = "require"; } catch(e) { loadMethod = "require_error"; }
                }
                if (!sm && typeof window !== 'undefined') {
                    for (var k in window) {
                        try {
                            if (window[k] && typeof window[k] === 'object' && typeof window[k].getIgnoreTimeScaleScheduler === 'function') {
                                sm = window[k]; loadMethod = "window_scan_" + k; break;
                            }
                        } catch(e) {}
                    }
                }
            }
            
            if (sm) {
                var ignoreSched = null;
                if (typeof sm.getIgnoreTimeScaleScheduler === 'function') {
                    ignoreSched = sm.getIgnoreTimeScaleScheduler();
                } else if (sm.ignore_timescale_scheduler) {
                    var keys = Object.keys(sm.ignore_timescale_scheduler);
                    if (keys.length > 0) ignoreSched = sm.ignore_timescale_scheduler[keys[0]];
                }
                
                var schedProto = null;
                if (ignoreSched) {
                    schedProto = ignoreSched.__proto__ || Object.getPrototypeOf(ignoreSched);
                } else if (sm.Scheduler && sm.Scheduler.prototype) {
                    schedProto = sm.Scheduler.prototype;
                }
                
                if (schedProto && typeof schedProto.update === 'function' && !schedProto._longPressUpdateHooked) {
                    schedProto._longPressUpdateHooked = true;
                    var origSchedUpdate = schedProto.update;
                    var _l2LogCount = 0;
                    
                    schedProto.update = function(dt) {
                        var curSpeed = (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') ? _SPEED_LEVELS[_speedIdx] : 1;
                        if (curSpeed > 1 && this.list && this.time_scale === 1) {
                            var fixedDt = dt / curSpeed;
                            if (_l2LogCount < 5) {
                                _l2LogCount++;
                                _speedLog('[LONG PRESS FIX] 🔧 L2 Scheduler(ts=1) update: dt=' + dt.toFixed(4) + ' → fixedDt=' + fixedDt.toFixed(4) + ' (÷' + curSpeed + ') list.len=' + (this.list.length || 0));
                            }
                            return origSchedUpdate.call(this, fixedDt);
                        }
                        return origSchedUpdate.call(this, dt);
                    };
                    _speedLog('[LONG PRESS FIX] ✅ L2 Hooked Scheduler.prototype.update via ' + loadMethod + '!');
                } else if (schedProto && schedProto._longPressUpdateHooked) {
                    _speedLog('[LONG PRESS FIX] L2 Scheduler.prototype.update already hooked');
                } else {
                    _speedLog('[LONG PRESS FIX] ⚠️ L2 Found module (' + loadMethod + ') but could not hook Scheduler.prototype.update');
                }
            } else {
                _speedLog('[LONG PRESS FIX] ⚠️ L2 Could not find SchedulerManager. loadMethod=' + loadMethod);
            }
        } catch (e) {
            _speedLog('[LONG PRESS FIX] ⚠️ L2 setup error: ' + e);
        }

        // ═══════════════════════════════════════════════════════════════
        // LAYER 3: 定期扫描（用 cc.Action 替代 setInterval）
        //   使用 cc.Director.getScheduler().schedule() 每 3 秒扫描一次
        //   找到场景中未修补的节点 update 并包裹
        // ═══════════════════════════════════════════════════════════════
        try {
            var _scanLogCount = 0;
            var _scanTarget = { _scanTick: 0 };

            // 使用引擎原生 scheduler 的 scheduleCallbackForTarget
            var nativeSched = cc.Director.getInstance().getScheduler();
            if (nativeSched && typeof nativeSched.schedule === 'function') {
                nativeSched.schedule(function(dt) {
                    try {
                        var scene = cc.Director.getInstance().getRunningScene();
                        if (!scene) return;

                        var queue = [scene];
                        var wrapped = 0;
                        var scanned = 0;
                        while (queue.length > 0) {
                            var node = queue.shift();
                            if (!node) continue;
                            scanned++;

                            if (typeof node.update === 'function' && !node.update._isLongPressFixed) {
                                if (typeof node.addTouchEventListener === 'function') {
                                    var origUpd = node.update;
                                    var fn = (function(orig) {
                                        var f = function(dt2) {
                                            var curSpeed = (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined') ? _SPEED_LEVELS[_speedIdx] : 1;
                                            var fixedDt2 = (curSpeed > 1) ? (dt2 / curSpeed) : dt2;
                                            return orig.call(this, fixedDt2);
                                        };
                                        f._isLongPressFixed = true;
                                        return f;
                                    })(origUpd);
                                    node.update = fn;
                                    wrapped++;
                                }
                            }

                            try {
                                if (typeof node.getChildren === 'function') {
                                    var children = node.getChildren();
                                    if (children) {
                                        var clen = (typeof children.length === 'function') ? children.length() : children.length;
                                        for (var ci = 0; ci < clen; ci++) {
                                            var child = (typeof children.get === 'function') ? children.get(ci) : children[ci];
                                            if (child) queue.push(child);
                                        }
                                    }
                                }
                            } catch (e) { }
                        }

                        if (wrapped > 0 && _scanLogCount < 10) {
                            _scanLogCount++;
                            _speedLog('[LONG PRESS FIX] 🔍 L3 Scan: wrapped ' + wrapped + '/' + scanned + ' nodes');
                        }
                    } catch (e) {
                        if (_scanLogCount < 3) {
                            _scanLogCount++;
                            _speedLog('[LONG PRESS FIX] L3 scan error: ' + e);
                        }
                    }
                }, _scanTarget, 3.0, cc.REPEAT_FOREVER || 0xFFFFFFFF, 0, false);
                _speedLog('[LONG PRESS FIX] L3 Scheduled periodic scan (3s interval via cc.Scheduler)');
            } else {
                _speedLog('[LONG PRESS FIX] ⚠️ L3 Native scheduler.schedule not available');
            }
        } catch (e) {
            _speedLog('[LONG PRESS FIX] L3 setup error: ' + e);
        }

        _uiHelperHooked = true;
        _speedLog('[LONG PRESS FIX] ✅ All layers installed (L1:proto + L2:scheduler + L3:scan)');
    } catch (e) {
        if (!_uiHelperHooked) {
            _speedLog('[LONG PRESS FIX] hook error: ' + e);
            _uiHelperHooked = true;
        }
    }
}

_speedLog('Initialized. F9=加速(2x>3x>5x) F10=重置(1x) F11=综合探测');

// _director_after_draw는 매우 자주 호출되므로 특별한 성능 측정 적용
let _director_after_draw_slow_count = 0;
const _original_director_after_draw = function () {
    // [免费声明] 首次进入时弹一次提示
    if (!global.pre._freeNoticeShown) {
        try {
            TitleScenePre.showNoticePopup('本软件完全免费！\n如果你是买来的，那么你被骗了！\n\n软件群聊：777529227', function () {
                // 拦截默认的重启行为，手动关闭弹窗
                try {
                    var layer = TitleScenePre.getTargetLayer();
                    if (layer && layer.getChildren) {
                        var children = layer.getChildren();
                        for (var i = 0; i < children.length; i++) {
                            var child = children[i];
                            if (child && child.findChildByName && child.findChildByName('main_text')) {
                                child.removeFromParent();
                                break;
                            }
                        }
                    }
                } catch (e) { }
            });
            global.pre._freeNoticeShown = true;
        } catch (e) { }
    }
    const patch_error = _getenv('patch.error')
    const patch_request = _getenv('patch.request')
    if (patch_request) {
        console.log('patch_request : ', patch_request)
        _setenv('patch.request', '')
    }
    if (global.pre.pause_director_after_draw) {

    } else if (patch_error) {
        let errorMessage = PreTexts.getText('patch_error') + '\n' + patch_error;
        if (patch_error.indexOf('E20114') !== -1) {
            errorMessage = PreTexts.getText('disk_space_error');
        }
        TitleScenePre.showNoticePopup(errorMessage)
        global.pre.pause_director_after_draw = true
    } else {
        const patch_status = _getenv('patch.status')
        if (!global.pre.is_load_application_resources && 'complete' == patch_status) {
            if (first_notice_after_patch) {
                process_next_notice_after_patch()
                first_notice_after_patch = false
            }
        }
        else if ('ask_download' == patch_status) {
            if (!is_waiting_for_user_action) {
                _ad_custom_event('singular', 'cdn_update_popup_shown', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
                is_waiting_for_user_action = true
                const download_total = _getenv("patch.download_total")
                const download_complete = _getenv("patch.download_complete")
                const download_kb = (download_total - download_complete) / 1024
                console.log('download_total : ', download_total, ' download_complete : ', download_complete, ' download_kb : ', download_kb)
                TitleScenePre.showConfirmDownloadPopup(download_kb, function (result) {
                    console.log('ask_download result : ', result)
                    if (result == true) {
                        console.log('ask_download result : true, start downloading')
                        _ad_custom_event('singular', 'cdn_update_popup_check_yes', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
                        _setenv('patch.status', 'downloading')
                        TitleScenePre.setPreButtonCallback(undefined)
                    } else {
                        console.log('ask_download result : false, cancel downloading')
                        _ad_custom_event('singular', 'cdn_update_popup_check_no', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
                        _setenv('patch.status', 'cancel')
                        TitleScenePre.setPreButtonCallback(function () {
                            console.log('starting patch again')
                            TitleScenePre.setPreButtonCallback(undefined)
                            TitleScenePre.startPatch()
                        })
                    }
                    is_waiting_for_user_action = false
                }, global.pre.is_pre_patch)
            }
        }
        else {
            TitleScenePre.update()
        }
    }
};

// _director_after_draw는 자주 호출되므로 100ms 이상일 때만 로깅하고, 10번 연속 느릴 때 특별 알림
var _lastKeepAliveTime = 0;
function _director_after_draw() {
    const startTime = Date.now();
    const result = _original_director_after_draw.apply(this, arguments);
    const executionTime = Date.now() - startTime;

    if (executionTime > 100) {
        _director_after_draw_slow_count++;
        if (_director_after_draw_slow_count >= 10) {
            console.log(`_director_after_draw() has been slow (>100ms) ${_director_after_draw_slow_count} times in a row. Latest: ${executionTime}ms`);
            _director_after_draw_slow_count = 0; // 리셋
        }
    } else {
        _director_after_draw_slow_count = 0; // 빠르면 카운터 리셋
    }

    // [加速器] 每帧检查并挂载加速按钮
    _tryAttachSpeedButton();
    // [LONG PRESS FIX] 检查并挂载长按补丁
    _hookLongPressUpdateProperty();


    return result;
}
global._director_after_draw = _director_after_draw

function _original_display_guide_good_game_use() {
    console.log(' display_guide_good_game_use ')

    let winSize = cc.Director.getInstance().getWinSize()
    let spr_guide = cc.CSLoader.createNode('ui/guide_good_game.csb')

    if (_get_cocos_refid(spr_guide)) {
        spr_guide.setOpacity(0)
        ResolutionHandler.getInstance().alignCenter(spr_guide);
        global.pre.pre_layer.addChild(spr_guide)

        console.log('_display_guide_good_game_use', winSize.width)

        let act_logo = cc.Sequence.create(
            cc.DelayTime.create(0.3),
            cc.FadeIn.create(0.5),
            cc.DelayTime.create(3.),
            cc.CallFunc.create(function () {
                _display_logo()
            }),
            cc.CallFunc.create(function () { global.pre.pre_layer.setColor(new cc.Color(255, 255, 255)) }),
            cc.FadeOut.create(0.5),
            cc.RemoveSelf.create()
        )
        spr_guide.runAction(act_logo)
    }
    else {
        console.error('not found ui/guide_good_game.csb')
        _display_logo()
    }
}

const _display_guide_good_game_use = measurePerformance(_original_display_guide_good_game_use, '_display_guide_good_game_use');

function _original_display_engine() {
    console.log('display engine ')

    let winSize = cc.Director.getInstance().getWinSize()
    let spr_engine = cc.CSLoader.createNode('ui/engine.csb')

    spr_engine.setOpacity(0)
    ResolutionHandler.getInstance().alignCenter(spr_engine);
    global.pre.pre_layer.addChild(spr_engine)

    let eff = bootres.get_effect('logo_yuna')
    if (eff) {
        spr_engine.getChildByName('n_engine').addChild(eff)

        let act_engine = cc.Sequence.create(
            cc.DelayTime.create(0.3),
            cc.CallFunc.create(function () { eff.setAnimation(0, 'animation', false) }),
            cc.FadeIn.create(0.2),
            cc.DelayTime.create(1.7),
            cc.CallFunc.create(function () { _start_title_scene() }),
            cc.FadeOut.create(0.3),
            cc.RemoveSelf.create()
        )
        spr_engine.runAction(act_engine)
    }
}

const _display_engine = measurePerformance(_original_display_engine, '_display_engine');

function _original_play_title_voice() {
    ccexp.SoundEngine.getInstance().unloadAll();
    console.debug("[SOUND] load master.string.bank ", ccexp.SoundEngine.getInstance().loadBankFile("sound/master.strings.bank"));
    console.debug("[SOUND] load master.bank ", ccexp.SoundEngine.getInstance().loadBankFile("sound/master.bank"));

    const fmod_result = ccexp.SoundEngine.getInstance().loadBankFile("sound/voc.event.bank");
    console.log(`LOG ~ _play_title_voice ~ fmod_result:`, fmod_result)

    let region = cc.UserDefault.getInstance()?.getStringForKey("voice_region_key", "ja");
    if (region == undefined || region == "ja") {
        region = "jp";
    }
    console.log(`LOG ~ _play_title_voice ~ region:`, region)
    const title_voice_list_result = cc.FileUtils.getInstance().isFileExist(`voice_text/title_voice_list.txt`)
    console.log(`LOG ~ _play_title_voice ~ title_voice_list_result:`, title_voice_list_result)
    const char_bank_result = ccexp.SoundEngine.getInstance().loadBankFile(`sound/1041_voc_${region}.bank`);
    console.log(`LOG ~ _play_title_voice ~ char_bank_result:`, char_bank_result)

    let voice_event_id = "event:/character/1041/voice/title_" + region; // event:/character/1041/voice/title_jp, title_ko, title_zhs
    if (fmod_result && title_voice_list_result && char_bank_result) {
        const db_result = cc.FileUtils.getInstance().getStringFromFile("voice_text/title_voice_list.txt");
        console.log(`LOG ~ _play_title_voice ~ db_result:`, db_result);

        const char_list = db_result.split(",");
        console.log(`🚀 ~ _play_title_voice ~ char_list:`, JSON.stringify(char_list))
        const char_id_dict = char_list.reduce(function (acc, id) {
            acc[id] = true;
            return acc;
        }, {});

        let random_char_id = null;
        let try_count = 0;
        while (true) {
            // 랜덤하게 하나 선택해서 플레이, 실패하면 빼고 다른 랜덤 캐릭터
            random_char_id = Object.keys(char_id_dict)[Math.floor(Math.random() * Object.keys(char_id_dict).length)];
            if (random_char_id != undefined) {
                const voice_bank_file = `sound/${random_char_id}_voc_${region}.bank`;
                if (!ccexp.SoundEngine.getInstance().isBankLoaded(voice_bank_file)) {
                    const fmod_result = ccexp.SoundEngine.getInstance().loadBankFile(voice_bank_file);
                    console.log(`LOG ~ _play_title_voice ~ voice_bank_file : ${voice_bank_file}, load result: ${fmod_result}`)
                } else {
                    random_char_id
                }

                const voice_event_result = ccexp.SoundEngine.getInstance().existsEvent(`event:/character/${random_char_id}/voice/title`);
                console.log(`LOG ~ _play_title_voice ~ existsEvent result:`, voice_event_result);

                if (voice_event_result) {
                    voice_event_id = `event:/character/${random_char_id}/voice/title`;
                    break;
                }
            }

            delete char_id_dict[random_char_id];
            try_count++;
            if (try_count > 100) {
                console.error('try_count > 100')
                break;
            }
        }
    } else {
        ccexp.SoundEngine.getInstance().unloadAll();
        console.log(`LOG ~ _play_title_voice ~ bundle.strings.bank exists ` + cc.FileUtils.getInstance().isFileExist(`sound/bundle.strings.bank`))
        console.log(`LOG ~ _play_title_voice ~ bundle.bank exists ` + cc.FileUtils.getInstance().isFileExist(`sound/bundle.bank`))
        console.debug("[SOUND] load bundle.string.bank ", ccexp.SoundEngine.getInstance().loadBankFile("sound/bundle.strings.bank"));
        console.debug("[SOUND] load bundle.bank ", ccexp.SoundEngine.getInstance().loadBankFile("sound/bundle.bank"));
    }

    if (ccexp.SoundEngine.getInstance().existsEvent(voice_event_id)) {
        console.log(`🚀 ~ _play_title_voice ~ voice_event_id:`, voice_event_id)
        const event_sound_object = ccexp.SoundEngine.getInstance().createEvent(voice_event_id);
        event_sound_object.start()
    } else {
        console.error('event not found : ', voice_event_id)
    }
}

const _play_title_voice = measurePerformance(_original_play_title_voice, '_play_title_voice');

const _original_display_rating = function () {
    let winSize = cc.Director.getInstance().getWinSize()
    let rating_node = cc.CSLoader.createNode('ui/title_rating.csb')
    rating_node.setOpacity(0)
    ResolutionHandler.getInstance().alignCenter(rating_node);

    global.pre.pre_layer.addChild(rating_node)

    console.log('_display_rating', winSize.width)

    const n_right = rating_node.getChildByName('right')
    const n_age_kr = n_right.getChildByName('n_age_kr')
    const btn_age_zhs = n_right.getChildByName('btn_age_zhs')
    const btn_age_tw = n_right.getChildByName('btn_age_tw')

    const n_right_original_pos = n_right.getPosition();
    n_right.setPosition((winSize.width - 1280) / 2, n_right_original_pos.y);

    n_age_kr.setVisible(false);
    btn_age_zhs.setVisible(false);
    btn_age_tw.setVisible(false);
    console.log('Util.getOsLanguage() : ', Util.getOsLanguage())
    switch (Util.getOsLanguage()) {
        case 'ko':
            n_age_kr.setVisible(true);
            break;
        // case 'zhs':
        // 	btn_age_zhs.setVisible(true);
        // 	break;
        // case 'zht':
        // 	btn_age_tw.setVisible(true);
        // 	break;
        default:
            {
                console.log("skip rating page, os lang : ", Util.getOsLanguage())
                rating_node.removeFromParent();
                _display_logo()
                return
            }
            break;
    }

    let act_logo = cc.Sequence.create(
        cc.DelayTime.create(0.3),
        cc.FadeIn.create(0.5),
        cc.DelayTime.create(2.5),
        cc.CallFunc.create(function () {
            _display_logo()
        }),
        cc.CallFunc.create(function () { global.pre.pre_layer.setColor(new cc.Color(255, 255, 255)) }),
        cc.FadeOut.create(0.5),
        cc.RemoveSelf.create()
    )
    rating_node.runAction(act_logo)
};
const _display_rating = measurePerformance(_original_display_rating, '_display_rating');

const _original_display_logo = function () {
    _play_title_voice();

    let winSize = cc.Director.getInstance().getWinSize()
    let spr_logo = cc.CSLoader.createNode('ui/logo.csb', function (e) { console.log(e.getName()) })
    spr_logo.setOpacity(0)
    ResolutionHandler.getInstance().alignCenter(spr_logo);
    global.pre.pre_layer.addChild(spr_logo)

    console.log('_display_logo', winSize.width)

    const n_right = spr_logo.getChildByName('right')
    n_right.setVisible(false);

    let n_logos = spr_logo.getChildByName('n_logos')
    n_logos.setScale(0.735)

    n_logos.runAction(cc.Sequence.create(cc.DelayTime.create(0.6), cc.EaseOut.create(cc.ScaleTo.create(1, 0.75), 2)))

    let act_logo_in = cc.Sequence.create(
        cc.DelayTime.create(0.3),
        cc.FadeIn.create(0.5),
        cc.DelayTime.create(1.4),
        cc.CallFunc.create(function () {
            _ad_custom_event('singular', 'czn_splash_screen_end', '0', '', '')
            spr_logo.stopAllActions()
            let act_logo_out = cc.Sequence.create(
                cc.CallFunc.create(function () { global.pre.pre_layer.setColor(new cc.Color(0, 0, 0)) }),
                cc.FadeOut.create(0.5),
                cc.CallFunc.create(function () {
                    TitleScenePre.start();
                }),
                cc.RemoveSelf.create()
            )
            spr_logo.runAction(act_logo_out)
        }),
    )
    spr_logo.runAction(act_logo_in)

    _ad_custom_event('singular', 'czn_splash_screen_start', '0', '', '')

    //번들팩 읽을때 느려서 미리 로딩 추가
    async function _preloadTitleUI() {
        try {
            console.log('[PRELOAD] Starting title UI preload...');
            const startTime = Date.now();
            const preloadedScene = cc.CSLoader.createNode('ui/scene_title_pre.csb');
            const loadTime = Date.now() - startTime;

            console.log(`[PRELOAD] _preloadTitleUI completed in ${loadTime}ms`);
        } catch (error) {
            console.error('[PRELOAD] Failed to _preloadTitleUI:', error);
        }
    };
    _preloadTitleUI().catch(error => {
        console.error('[PRELOAD] Unhandled error in title UI preload:', error);
    });
};
const _display_logo = measurePerformance(_original_display_logo, '_display_logo');

function _get_version_json() {
    try {
        /*
        const testmode_maintenance = _getenv( "maintenance.mode" , "testpatch" ) 		
        if( testmode_maintenance == "testmode" ) {
            const elpsed_time = 5
            const now = Math.floor(Date.now() / 1000)
            const test_version_json = {"_appid":"ssrdev","_entry_timestamp":now,"maintenance":[{"id":1,"world":"asia","start_time":(now-elpsed_time),"end_time":(now+elpsed_time),"title":"테스트 점검","msg":"점검 테스트 중입니다","url_notice":"","url_patch_note":"","url_sns":"","status":-1}],"world":{"asia":{"live":{"app.api":"ws://ssrdev.supercre.com:13100/api/","build.version":"58","cdn.context":"$(remote.res.version)/$(remote.res.version)-$(local.res.version).tar.lz4","cdn.sign":"http://localhost:8000","cdn.url":"https://devpatch11.supercreative.kr:3043/ssrdev_patch/","cdn.version.policies":"res,media,text","cdn.version_media.current":1,"cdn.version_res.current":1,"cdn.version_text.current":1,"game.timezone":"9","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"https://czn-qa-down.game.playstove.com/patch/common/title_pre.mp4?inet_cache=ignore_update","verinfo.status":"running"},"review":{"app.api":"ws://ssrdev.supercre.com:13100/api/","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"https://czn-qa-down.game.playstove.com/patch/common/title_pre.mp4?inet_cache=ignore_update","verinfo.status":"running"}},"global":{"live":{"app.api":"ws://ssrdev.supercre.com:13100/api/","build.version":"57","cdn.context":"$(remote.res.version)/$(remote.res.version)-$(local.res.version).tar.lz4","cdn.url":"https://devpatch11.supercreative.kr:3043/ssrdev_patch/","cdn.version.policies":"res,media,text","cdn.version_media.current":1,"cdn.version_res.current":1,"cdn.version_text.current":1,"game.timezone":"9","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"http://czn-qa-down.game.playstove.com/patch/1.0.147/webpubs/res/cinema/ko/title2.mp4?inet_cache=ignore_update","verinfo.status":"running"},"review":{"app.api":"","verinfo.status":"running"}}}}			
            _setenv('verinfo.data', JSON.stringify( test_version_json ) )
            _setenv( "maintenance.mode" , "" )
        }
        if( testmode_maintenance == "testpatch" ) {			
            const now = Math.floor(Date.now() / 1000)
            const test_version_json = {"_appid":"ssrdev","_entry_timestamp":now,"maintenance":[],"world":{"asia":{"live":{"app.api":"ws://ssrdev.supercre.com:13100/api/","build.version":"58","cdn.context":"$(remote.res.version)/$(remote.res.version)-$(local.res.version).tar.lz4","cdn.sign":"http://localhost:8000","cdn.url":"https://devpatch11.supercreative.kr:3043/ssrdev_patch/","cdn.version.policies":"res,media,text","cdn.version_media.current":1,"cdn.version_res.current":1,"cdn.version_text.current":1,"game.timezone":"9","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"https://czn-qa-down.game.playstove.com/patch/common/title_pre.mp4?inet_cache=ignore_update","verinfo.status":"running"},"review":{"app.api":"ws://ssrdev.supercre.com:13100/api/","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"https://czn-qa-down.game.playstove.com/patch/common/title_pre.mp4?inet_cache=ignore_update","verinfo.status":"running"}},"global":{"live":{"app.api":"ws://ssrdev.supercre.com:13100/api/","build.version":"57","cdn.context":"$(remote.res.version)/$(remote.res.version)-$(local.res.version).tar.lz4","cdn.url":"https://devpatch11.supercreative.kr:3043/ssrdev_patch/","cdn.version.policies":"res,media,text","cdn.version_media.current":1,"cdn.version_res.current":1,"cdn.version_text.current":1,"game.timezone":"9","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"http://czn-qa-down.game.playstove.com/patch/1.0.147/webpubs/res/cinema/ko/title2.mp4?inet_cache=ignore_update","verinfo.status":"running"},"review":{"app.api":"","verinfo.status":"running"}}}}			
            _setenv('verinfo.data', JSON.stringify( test_version_json ) )
            _setenv( "maintenance.mode" , "" )
        }
        */
        return JSON.parse(_getenv('verinfo.data', "{}"))
    } catch (error) {
        console.error('verinfo.data is empty : ', error)
    }
    return {}
}
globalThis._get_version_json = _get_version_json;

function _load_remote_environment_and_prefetch() {
    console.log('🚀 [EARLY FETCH] Starting native remote environment load immediately...')
    global.pre.early_fetch_promise = new Promise(function (resolve) {
        _async_load_remote_environment(function (result) {

            if (result) {
                if (`${_getenv('xcent.dolphin', 0)}` != "1") {
                    try {
                        const version_json = _get_version_json()

                        const target_version_json = EntryUtil.getTargetVersionInfo(version_json)
                        const stringified_target_version_json = JSON.stringify(target_version_json)
                        //console.log('target_version_json : ', stringified_target_version_json)
                        _load_json_environment(stringified_target_version_json)
                        //prefetch 때 멈춤
                        _setenv("patch.should", "prefetch");
                        _start_patch();
                    } catch (error) {
                        //에러나면 포기	
                        console.error("_load_remote_environment_and_prefetch error : ", error)
                    }
                }
            }
            resolve(result)
        })
    })
}

const _original_application_start_contents = function (event) {
    // _js_start_profile();


    _perf_gem_post_step_event('login', 0, 0, 0, 'success', '', false, false)
    console.log('_application_start_contents ' + typeof (event), event.getEventListener())
    cc.Director.getInstance().getEventDispatcher().removeEventListener(event.getEventListener())

    global.pre = {}
    Util._event_listeners = {}
    _setenv("patch.status", "");

    // ⭐ [EARLY FETCH] 가장 먼저 네이티브 통신 시작 (Risk 최소화 버전)
    _load_remote_environment_and_prefetch();


    console.log('application_start_contents initialized')

    // if app.lang = zhs, then set user lang as zhs too

    if (_getenv('app.lang') == 'zhs') {
        console.log('app.lang is zhs, set user lang as zhs')
        _set_user_language('zhs')
    }

    const app_production = _getenv('app.production', false)
    console.log('app.production : ', app_production)

    // 만약 app.pubid 가 xcent 가 아닌데 user lang 이 zhs 라면, 언어 초기화
    const app_pubid = _getenv('app.pubid')
    console.log('app.pubid : ', app_pubid)
    if (app_pubid != 'xcent') {
        const user_lang = Util.getUserLanguage()
        console.log('user lang : ', user_lang)
        if (user_lang == 'zhs') {
            console.log('app.pubid is not xcent, and user lang is zhs')
            if (app_production) {
                console.log('app.production is true, set user lang to default')
                _set_user_language('')
            } else {
                console.log('app.production is false, set user lang to ko')
                _set_user_language('ko')
            }
        }
    }

    Util.setPreFileFilter()

    let cocosScene = cc.Scene.create()
    //_async_load_version_info()
    //print( 'create background layer ' )
    global.pre.pre_layer = cc.LayerColor.create(new cc.Color(255, 255, 255, 255))
    cocosScene.bg_layer = global.pre.pre_layer
    cocosScene.addChild(global.pre.pre_layer)

    let play_logo = _getenv('logo.play')
    console.log('logo.play : ' + play_logo)
    if (play_logo != false) {
        if (Util.getUserLanguage() == 'zhs') {
            _display_guide_good_game_use()
        } else {
            _display_rating()
        }
    } else {
        TitleScenePre.start();
    }

    cc.Director.getInstance().runWithScene(cocosScene)

    let patch_version_override = _getenv('patch.version.override')
    if (patch_version_override != undefined) {
        console.log('patch version override:', patch_version_override)
        _setenv('patch.version', patch_version_override)
    }
    console.log('patch version : ' + _getenv('patch.version'))
};
const _application_start_contents = measurePerformance(_original_application_start_contents, '_application_start_contents');

// pre 에서 exi handler listen 하는 경우 사용 (추후 script 단에서 덮어쓰도록, 현재 gcs용)
global._external_interface_handler_call = function (type, jstr) {
    console.log('pre external interface handler call : ', type, jstr)
    if (type == 'stove/gcs') {
        global.pre.stove_gcs = jstr;
    }
};


cc.Director.getInstance().getEventDispatcher().addCustomEventListener('application_start_contents', _application_start_contents)

