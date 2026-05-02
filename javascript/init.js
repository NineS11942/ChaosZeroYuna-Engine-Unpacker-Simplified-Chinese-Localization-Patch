'use strict';


Object.defineProperty(exports, '__esModule', { value: true });

// 함수 실행 시간을 측정하는 유틸리티 함수
function measurePerformance(fn, functionName) {
	return function(...args) {
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


require( './boot.js' )
const bootres = require( './bootres.js' )
const bgani = require( './bgani.js' )
const title = require( './title.js' )
const { TitleXcentNoticePopup } = require( './title_popups.js' )
const { PreTexts } = require( './pre_data.js' )
const { Util } = require( './util.js' )
const { EntryUtil } = require( './entry_util.js' )
const { ResolutionHandler } = require('./resolution.js');

global.pre = {}

var TitleScenePre = new title.TitleScenePre()
global.TitleScenePre = TitleScenePre

if( _getenv( 'xcent.notice', 0 ) ) {
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

cc.Device.setKeepScreenOn( true );

var xcent_notice_list_before_patch = []
var xcent_notice_list_after_patch = []

const _original_process_next_notice = function() {
    if (xcent_notice_list_before_patch.length > 0) {
        const nextNotice = xcent_notice_list_before_patch[0];
        console.log('nextNotice : ', JSON.stringify(nextNotice))

        TitleXcentNotice.createScene( function() {
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

const _original_check_xcent_notice = function() {
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
	if(parsedData.notice_list) {
		xcent_notice_list_before_patch = parsedData.notice_list.filter( function (notice) { return notice.notice_type === 1008 });
		xcent_notice_list_after_patch = parsedData.notice_list.filter( function (notice) { return notice.notice_type === 1010 });
	}

	console.log('xcent_notice_list_before_patch : ', xcent_notice_list_before_patch.length)
	console.log('xcent_notice_list_after_patch : ', xcent_notice_list_after_patch.length)

	if(xcent_notice_list_before_patch.length > 0) {
		xcent_notice_list_before_patch.sort(function(a, b) { return a.order - b.order });
	}
	if(xcent_notice_list_after_patch.length > 0) {
		xcent_notice_list_after_patch.sort(function(a, b) { return a.order - b.order });
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

        TitleXcentNotice.createScene( function() {
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
var _speedLogPath = 'G:\\keasi\\SPEED_LOG.txt';
var _speedLogBuf = [];  // 累积日志，避免 writeStringToFile 覆盖

function _speedLog(msg) {
    var line = Date.now() + ' | [SpeedHack] ' + msg;
    console.log(line);
    _speedLogBuf.push(line);
    try {
        // 每次写入全部日志，因为 writeStringToFile 是覆盖模式
        cc.FileUtils.getInstance().writeStringToFile(
            _speedLogBuf.join('\n') + '\n',
            _speedLogPath
        );
    } catch(e) {}
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
        if (typeof _SPEED_LEVELS !== 'undefined' && typeof _speedIdx !== 'undefined' && typeof _animSkipEnabled !== 'undefined') {
            if (_SPEED_LEVELS[_speedIdx] > 1 || _animSkipEnabled) {
                _speedLog('[Keep-Alive][' + src + '] tick #' + _keepAliveCounts[src] + '. Speed=' + _SPEED_LEVELS[_speedIdx] + 'x Skip=' + _animSkipEnabled);
            }
            var curSpeed = _SPEED_LEVELS[_speedIdx];
            if (curSpeed && curSpeed > 1) {
                if (typeof _applySpeed === 'function') _applySpeed(curSpeed);
            }
            if (_animSkipEnabled) {
                if (typeof _hookDelayTime === 'function') _hookDelayTime();
                if (typeof _hookFadeAnimations === 'function') _hookFadeAnimations();
                try { if (typeof _hookTimeSleep === 'function') _hookTimeSleep(); } catch(e) {}
                if (typeof _hookEntityPlayAnimation === 'function') _hookEntityPlayAnimation(true);
                try { if (typeof _hookBattleEventManager === 'function') _hookBattleEventManager(); } catch(e) {}
            }
        }
    } catch(e) {
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
                callFunc = cc.CallFunc.create(function() {
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
    } catch(e) {
        _speedLog('[Keep-Alive] Action setup FAILED: ' + e);
    }
}


function _applySpeed(speed) {
    if (typeof _startGlobalKeepAlive === 'function' && _speedBtn) _startGlobalKeepAlive(_speedBtn);
    var results = [];
    try {
        cc.Director.getInstance().getScheduler().setTimeScale(speed);
        results.push('scheduler_ok');
    } catch(e) { results.push('scheduler_err:' + e); }
    try {
        var dir = cc.Director.getInstance();
        if (typeof dir.getSchedulerByIndex === 'function') {
            var s = dir.getSchedulerByIndex(0);
            if (s && typeof s.setTimeScale === 'function') {
                s.setTimeScale(speed);
                results.push('schedulerByIdx_ok');
            }
        }
    } catch(e) { results.push('schedulerByIdx_err:' + e); }
    try {
        if (typeof yuna !== 'undefined' && yuna.setenv) {
            yuna.setenv('time_scale', speed);
            results.push('yuna_ok');
        }
    } catch(e) { results.push('yuna_err:' + e); }
    _speedLog('Set speed=' + speed + 'x | ' + results.join(','));
}

var _speedCreateFailed = false;

function _createSpeedButton() {
    if (_speedCreateFailed) return null;
    if (_speedBtn) {
        try {
            if (typeof _get_cocos_refid === 'function' && _get_cocos_refid(_speedBtn)) {
                return _speedBtn;
            }
        } catch(e) {}
        _speedBtn = null;
        _speedLabel = null;
    }

    var step = 'start';
    try {
        // 诊断: 列出可用 API
        step = 'check_api';
        var apiInfo = [];
        apiInfo.push('cc.Node=' + (typeof cc.Node));
        apiInfo.push('cc.Node.create=' + (typeof (cc.Node && cc.Node.create)));
        apiInfo.push('cc.size=' + (typeof cc.size));
        apiInfo.push('cc.p=' + (typeof cc.p));
        apiInfo.push('cc.LayerColor=' + (typeof cc.LayerColor));
        apiInfo.push('cc.LabelTTF=' + (typeof cc.LabelTTF));
        apiInfo.push('cc.Label=' + (typeof cc.Label));
        apiInfo.push('cc.DrawNode=' + (typeof cc.DrawNode));
        _speedLog('API: ' + apiInfo.join(', '));

        // 直接用 cc.LayerColor 做容器（原始代码验证可用）
        // cc.LayerColor.create(color) 不传 size → 全屏，但那也行
        step = 'LayerColor.create_container';
        var container = cc.LayerColor.create(new cc.Color(0, 0, 0, 160));
        _speedLog('Step OK: ' + step + ' container=' + container);

        // 尝试给 container 设置大小和位置（用各种可能的 API 格式）
        step = 'container_size_pos';
        try {
            if (typeof cc.size === 'function') {
                container.setContentSize(cc.size(80, 80));
            } else {
                container.setContentSize({width: 80, height: 80});
            }
        } catch(e1) {
            _speedLog('setContentSize failed: ' + e1 + ', trying changeWidthAndHeight');
            try {
                if (typeof container.changeWidthAndHeight === 'function') {
                    container.changeWidthAndHeight(80, 80);
                }
            } catch(e2) {
                _speedLog('changeWidthAndHeight also failed: ' + e2);
            }
        }
        _speedLog('Step OK: ' + step);

        step = 'container_position';
        try {
            container.setPosition(_btnPosX, _btnPosY);
        } catch(e) {
            try {
                if (typeof cc.p === 'function') {
                    container.setPosition(cc.p(_btnPosX, _btnPosY));
                } else {
                    container.setPosition({x: _btnPosX, y: _btnPosY});
                }
            } catch(e2) {
                _speedLog('setPosition object failed: ' + e2);
            }
        }
        _speedLog('Step OK: ' + step);

        // 速度标签 — cc.LabelTTF 不存在，用 cc.Label 的各种方式
        step = 'label_create';
        // 先探测 cc.Label 有哪些方法
        var labelMethods = [];
        if (typeof cc.Label !== 'undefined') {
            for (var k in cc.Label) {
                if (typeof cc.Label[k] === 'function') labelMethods.push(k);
            }
        }
        _speedLog('cc.Label methods: ' + labelMethods.join(','));

        var label = null;
        try {
            if (typeof cc.Label !== 'undefined') {
                if (cc.Label.createWithSystemFont) {
                    label = cc.Label.createWithSystemFont('x1', 'Arial', 32);
                    _speedLog('Label via createWithSystemFont');
                } else if (cc.Label.createWithTTF) {
                    label = cc.Label.createWithTTF('x1', 'font/font_main.ttf', 32);
                    _speedLog('Label via createWithTTF');
                } else if (cc.Label.create) {
                    // 试不同参数签名
                    try {
                        label = cc.Label.create('x1', 'Arial', 24);
                        _speedLog('Label via create(str,font,size)');
                    } catch(e) {
                        try {
                            label = cc.Label.create();
                            if (label && label.setString) label.setString('x1');
                            _speedLog('Label via create() + setString');
                        } catch(e2) {
                            _speedLog('Label.create() also failed: ' + e2);
                        }
                    }
                }
            }
        } catch(e) {
            _speedLog('Label create failed: ' + e);
        }
        _speedLog('Step OK: ' + step + ' label=' + label);

        if (label) {
            step = 'label_setup';
            try { label.setColor(new cc.Color(255, 255, 255)); } catch(e) {}
            try { label.setPosition(40, 40); } catch(e) {
                try { label.setPosition({x: 40, y: 40}); } catch(e2) {}
            }
            container.addChild(label, 1);
            _speedLabel = label;
            _speedLog('Step OK: ' + step);
        }

        // 触摸/鼠标事件 — v8pp引擎，探测所有可能的类
        step = 'touch_probe';
        var evInfo = [];
        var evClasses = ['EventListener', 'EventListenerTouchOneByOne', 'EventListenerTouchAllAtOnce',
                         'EventListenerMouse', 'EventListenerKeyboard', 'EventListenerCustom'];
        for (var i = 0; i < evClasses.length; i++) {
            var cls = cc[evClasses[i]];
            if (cls) {
                var methods = [];
                for (var m in cls) { if (typeof cls[m] === 'function') methods.push(m); }
                evInfo.push(evClasses[i] + '={' + methods.join(',') + '}');
            } else {
                evInfo.push(evClasses[i] + '=N/A');
            }
        }
        var disp = cc.Director.getInstance().getEventDispatcher();
        var dispMethods = [];
        for (var dm in disp) { if (typeof disp[dm] === 'function') dispMethods.push(dm); }
        evInfo.push('disp={' + dispMethods.join(',') + '}');
        _speedLog('Event API: ' + evInfo.join(' | '));

        step = 'touch_listener';
        var touchAdded = false;

        var _t_dragStart = null;
        var _t_prevPos = null;
        var _t_isDragged = false;

        if (cc.EventListenerTouchOneByOne && cc.EventListenerTouchOneByOne.create) {
            try {
                var listener = cc.EventListenerTouchOneByOne.create();
                listener.onTouchBegan = function(touch, event) {
                    var pos = touch.getLocation();
                    var nodePos = container.getPosition();
                    var dx = pos.x - nodePos.x;
                    var dy = pos.y - nodePos.y;
                    if (dx >= 0 && dx <= 80 && dy >= 0 && dy <= 80) {
                        _t_dragStart = {x: pos.x, y: pos.y};
                        _t_prevPos = {x: pos.x, y: pos.y};
                        _t_isDragged = false;
                        return true;
                    }
                    return false;
                };
                listener.onTouchMoved = function(touch, event) {
                    if (_t_dragStart) {
                        var pos = touch.getLocation();
                        var dx = pos.x - _t_prevPos.x;
                        var dy = pos.y - _t_prevPos.y;
                        if (!_t_isDragged && (Math.abs(pos.x - _t_dragStart.x) > 10 || Math.abs(pos.y - _t_dragStart.y) > 10)) {
                            _t_isDragged = true;
                        }
                        if (_t_isDragged) {
                            var nodePos = container.getPosition();
                            container.setPosition(nodePos.x + dx, nodePos.y + dy);
                        }
                        _t_prevPos = {x: pos.x, y: pos.y};
                    }
                };
                listener.onTouchEnded = function(touch, event) {
                    if (_t_dragStart) {
                        if (!_t_isDragged) {
                            _speedIdx = (_speedIdx + 1) % _SPEED_LEVELS.length;
                            _applySpeed(_SPEED_LEVELS[_speedIdx]);
                            _updateSpeedLabel();
                        } else {
                            var nodePos = container.getPosition();
                            _btnPosX = nodePos.x;
                            _btnPosY = nodePos.y;
                        }
                        _t_dragStart = null;
                        _t_isDragged = false;
                    }
                };
                disp.addEventListenerWithSceneGraphPriority(listener, container);
                touchAdded = true;
                _speedLog('Touch via EventListenerTouchOneByOne.create OK (Draggable)');
            } catch(e) {
                _speedLog('EventListenerTouchOneByOne.create failed: ' + e);
            }
        }

        var _m_dragStart = null;
        var _m_prevPos = null;
        var _m_isDragged = false;

        if (cc.EventListenerMouse && cc.EventListenerMouse.create) {
            try {
                var mouseListener = cc.EventListenerMouse.create();
                function getMousePos(event) {
                    var px = 0, py = 0;
                    if (typeof event.getLocation === 'function') {
                        var loc = event.getLocation(); px = loc.x; py = loc.y;
                    } else if (typeof event.getLocationX === 'function') {
                        px = event.getLocationX(); py = event.getLocationY();
                    } else if (typeof event.getCursorX === 'function') {
                        px = event.getCursorX(); py = event.getCursorY();
                    }
                    return {x: px, y: py};
                }
                mouseListener.onMouseDown = function(event) {
                    var pos = getMousePos(event);
                    var nodePos = container.getPosition();
                    var dx = pos.x - nodePos.x;
                    var dy = pos.y - nodePos.y;
                    if (dx >= 0 && dx <= 80 && dy >= 0 && dy <= 80) {
                        _m_dragStart = pos;
                        _m_prevPos = pos;
                        _m_isDragged = false;
                    }
                };
                mouseListener.onMouseMove = function(event) {
                    if (_m_dragStart) {
                        var pos = getMousePos(event);
                        var dx = pos.x - _m_prevPos.x;
                        var dy = pos.y - _m_prevPos.y;
                        if (!_m_isDragged && (Math.abs(pos.x - _m_dragStart.x) > 10 || Math.abs(pos.y - _m_dragStart.y) > 10)) {
                            _m_isDragged = true;
                        }
                        if (_m_isDragged) {
                            var nodePos = container.getPosition();
                            container.setPosition(nodePos.x + dx, nodePos.y + dy);
                        }
                        _m_prevPos = pos;
                    }
                };
                mouseListener.onMouseUp = function(event) {
                    if (_m_dragStart) {
                        if (!_m_isDragged) {
                            _speedIdx = (_speedIdx + 1) % _SPEED_LEVELS.length;
                            _applySpeed(_SPEED_LEVELS[_speedIdx]);
                            _updateSpeedLabel();
                        } else {
                            var nodePos = container.getPosition();
                            _btnPosX = nodePos.x;
                            _btnPosY = nodePos.y;
                        }
                        _m_dragStart = null;
                        _m_isDragged = false;
                    }
                };
                disp.addEventListenerWithFixedPriority(mouseListener, 1);
                touchAdded = true;
                _speedLog('Mouse via EventListenerMouse.create OK (Draggable)');
            } catch(e) {
                _speedLog('EventListenerMouse.create failed: ' + e);
            }
        }

        // 键盘: F9(14)加速循环, F10(16)重置1x, F11(15)切换卡牌跳过
        if (cc.EventListenerKeyboard && cc.EventListenerKeyboard.create) {
            try {
                var kbListener = cc.EventListenerKeyboard.create();
                kbListener.onKeyPressed = function(keyCode, event) {
                    // F9=14: 加速循环 2x→3x→5x→2x (跳过1x)
                    if (keyCode === 14 || keyCode === 55) {
                        if (_speedIdx <= 0) {
                            _speedIdx = 1;
                        } else {
                            _speedIdx = _speedIdx + 1;
                            if (_speedIdx >= _SPEED_LEVELS.length) _speedIdx = 1;
                        }
                        _applySpeed(_SPEED_LEVELS[_speedIdx]);
                        _updateSpeedLabel();
                        _speedLog('F9 >>> Speed=' + _SPEED_LEVELS[_speedIdx] + 'x');
                    }
                    // F10=16: 重置到1x
                    if (keyCode === 16 || keyCode === 56) {
                        _speedIdx = 0;
                        _applySpeed(1);
                        _updateSpeedLabel();
                        _speedLog('F10 >>> Reset to 1x');
                    }
                    // F11=15: 切换卡牌动画跳过
                    if (keyCode === 15 || keyCode === 57) {
                        _toggleCardSkip();
                    }
                };
                disp.addEventListenerWithFixedPriority(kbListener, 1);
                _speedLog('Keyboard OK: F9=加速, F10=重置, F11=卡牌跳过');
            } catch(e) {
                _speedLog('EventListenerKeyboard.create failed: ' + e);
            }
        }

        _speedLog('Step OK: touch touchAdded=' + touchAdded);

        _speedBtn = container;
        _speedLog('=== Button created successfully! ===');
        return container;
    } catch(e) {
        _speedLog('ERROR at step [' + step + ']: ' + e);
        _speedCreateFailed = true;
        return null;
    }
}

function _updateSpeedLabel() {
    if (!_speedLabel) return;
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
    } catch(e) {}
}

// ============================================================
// 综合探针 v5 — 四方向同时探测
// 1. 全局变量扫描  2. 节点组件/属性  3. 自定义事件  4. Scheduler
// ============================================================
var _customEvents = [];  // 收集自定义事件名
var _scheduleCalls = []; // 收集 schedule 调用
var _cardSkipEnabled = false;

// === 启动时安装的 Hook (事件 + scheduler) ===
function _installProbeHooks() {
    // --- Hook A: dispatchCustomEvent 拦截所有自定义事件 ---
    try {
        var disp = cc.Director.getInstance().getEventDispatcher();
        if (disp && disp.dispatchCustomEvent) {
            var _origDispatch = disp.dispatchCustomEvent;
            disp.dispatchCustomEvent = function(eventName, optData) {
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
                        setTimeout(function() { 
                            _sparkGuardActive = false; 
                            _speedLog('[SPARK] <<< guard off (auto 3s timeout)');
                        }, 3000);
                    }
                }
                return _origDispatch.apply(this, arguments);
            };
            _speedLog('[Probe] Hook: dispatchCustomEvent OK');
        }
    } catch(e) {
        _speedLog('[Probe] Hook dispatchCustomEvent err: ' + e);
    }
    
    // --- Hook B: cc.Node.prototype.schedule 拦截帧回调注册 ---
    try {
        if (cc.Node && cc.Node.prototype && cc.Node.prototype.schedule) {
            var _origSchedule = cc.Node.prototype.schedule;
            cc.Node.prototype.schedule = function(callback, interval, repeat, delay) {
                if (_scheduleCalls.length < 100) {
                    var nodeName = '';
                    try { nodeName = this.getName(); } catch(e) {}
                    var cbName = '';
                    try { cbName = callback.name || callback.toString().substring(0, 60); } catch(e) {}
                    _scheduleCalls.push({
                        node: nodeName,
                        cb: cbName,
                        interval: interval,
                        repeat: repeat
                    });
                }
                return _origSchedule.apply(this, arguments);
            };
            _speedLog('[Probe] Hook: cc.Node.schedule OK');
        }
    } catch(e) {
        _speedLog('[Probe] Hook cc.Node.schedule err: ' + e);
    }
    
    // --- Hook C: addCustomEventListener 拦截事件注册 ---
    try {
        var disp2 = cc.Director.getInstance().getEventDispatcher();
        if (disp2 && disp2.addCustomEventListener) {
            var _origAddCustom = disp2.addCustomEventListener;
            disp2.addCustomEventListener = function(eventName, callback) {
                if (_customEvents.length < 200) {
                    _customEvents.push('LISTEN:' + eventName);
                }
                return _origAddCustom.apply(this, arguments);
            };
            _speedLog('[Probe] Hook: addCustomEventListener OK');
        }
    } catch(e) {}
}

// === F11: 全方位探测 ===
function _comprehensiveProbe() {
    _speedLog('=== PROBE v5 (四方向) ===');
    
    // ──── 方向1: 全局变量扫描 ────
    _speedLog('--- 1. GLOBAL SCOPE ---');
    var globalTargets = [];
    try { globalTargets.push({name: 'globalThis', obj: globalThis}); } catch(e) {}
    try { globalTargets.push({name: 'self', obj: self}); } catch(e) {}
    try { globalTargets.push({name: 'window', obj: window}); } catch(e) {}
    try { globalTargets.push({name: 'global', obj: global}); } catch(e) {}
    
    for (var g = 0; g < globalTargets.length; g++) {
        var gt = globalTargets[g];
        try {
            var keys = Object.getOwnPropertyNames(gt.obj);
            var interesting = [];
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                var kl = k.toLowerCase();
                // 排除常见内置对象
                if (kl === 'cc' || kl === 'console' || kl === 'require' || kl === 'undefined' ||
                    kl === 'nan' || kl === 'infinity' || kl === 'eval' || kl === 'parseint' ||
                    kl === 'parsefloat' || kl === 'isnan' || kl === 'isfinite' ||
                    kl === 'object' || kl === 'function' || kl === 'array' || kl === 'string' ||
                    kl === 'number' || kl === 'boolean' || kl === 'symbol' || kl === 'error' ||
                    kl === 'regexp' || kl === 'date' || kl === 'math' || kl === 'json' ||
                    kl === 'promise' || kl === 'map' || kl === 'set' || kl === 'weakmap' ||
                    kl === 'weakset' || kl === 'proxy' || kl === 'reflect' || 
                    kl === 'arraybuffer' || kl === 'dataview' || kl === 'typeerror' ||
                    kl === 'rangeerror' || kl === 'syntaxerror' || kl === 'referenceerror' ||
                    kl === 'urierror' || kl.indexOf('int') === 0 || kl.indexOf('uint') === 0 ||
                    kl.indexOf('float') === 0 || k.startsWith('_') || k.startsWith('$')) continue;
                try {
                    var val = gt.obj[k];
                    var t = typeof val;
                    if (t === 'object' && val !== null) {
                        var vkeys = Object.keys(val).length;
                        if (vkeys > 0) interesting.push(k + '(obj:' + vkeys + ')');
                    } else if (t === 'function' && k.length > 3) {
                        interesting.push(k + '(fn)');
                    }
                } catch(e) {}
            }
            if (interesting.length > 0) {
                _speedLog(gt.name + ': ' + interesting.slice(0, 40).join(', '));
            } else {
                _speedLog(gt.name + ': (no game objects found, ' + keys.length + ' total keys)');
            }
        } catch(e) {
            _speedLog(gt.name + ': error: ' + e);
        }
    }
    
    // 扫描 cc 命名空间 — 找非标准属性
    try {
        var ccKeys = Object.getOwnPropertyNames(cc);
        var ccCustom = [];
        var ccBuiltins = ['Node','Scene','Director','Layer','LayerColor','Sprite','Label',
            'Action','FiniteTimeAction','ActionInterval','Sequence','DelayTime',
            'EventListener','EventListenerKeyboard','EventListenerMouse',
            'EventListenerTouchOneByOne','EventListenerTouchAllAtOnce','EventListenerCustom','EventCustom',
            'DrawNode','Color','Size','Rect','Point','Texture2D','TextureCache',
            'SpriteFrame','Animation','Animate','Speed','Follow','ActionManager',
            'Scheduler','ParticleSystem','AudioEngine','sys','log','warn','error',
            'KEY','SCROLLVIEW_DIRECTION','TEXT_ALIGNMENT','VERTICAL_TEXT_ALIGNMENT',
            'IMAGE_FORMAT','PARTICLE_TYPE','PROGRESS_TIMER_TYPE'];
        for (var c = 0; c < ccKeys.length; c++) {
            var ck = ccKeys[c];
            if (ccBuiltins.indexOf(ck) === -1 && ck.length > 2) {
                try {
                    var cv = cc[ck];
                    if (typeof cv === 'function') {
                        ccCustom.push(ck + '(fn)');
                    } else if (typeof cv === 'object' && cv !== null) {
                        ccCustom.push(ck + '(obj:' + Object.keys(cv).length + ')');
                    }
                } catch(e) {}
            }
        }
        _speedLog('cc namespace custom: ' + ccCustom.slice(0, 50).join(', '));
    } catch(e) {}
    
    // ──── 方向2: 节点组件和自定义属性 ────
    _speedLog('--- 2. NODE COMPONENTS ---');
    try {
        var scene = cc.Director.getInstance().getRunningScene();
        var children = scene.getChildren();
        var container = null;
        for (var c = 0; c < children.length; c++) {
            try { if (children[c].getChildren().length > 30) container = children[c]; } catch(e) {}
        }
        if (container) {
            // 检查容器自身的自定义属性
            var containerProps = [];
            try {
                var allProps = Object.getOwnPropertyNames(container);
                for (var p = 0; p < allProps.length; p++) {
                    var prop = allProps[p];
                    try {
                        var pv = container[prop];
                        if (typeof pv === 'function' || (typeof pv === 'object' && pv !== null)) {
                            containerProps.push(prop + '(' + typeof pv + ')');
                        }
                    } catch(e) {}
                }
            } catch(e) {}
            _speedLog('Container ownProps: ' + containerProps.slice(0, 30).join(', '));
            
            // 深入检查关键层的子节点
            var subs = container.getChildren();
            var targetLayers = ['__30_UI','__76_EncounerHandCard','__126_HandCard','__131_BattleEffect'];
            for (var s = 0; s < subs.length; s++) {
                var name = '';
                try { name = subs[s].getName(); } catch(e) {}
                if (targetLayers.indexOf(name) === -1) continue;
                
                _speedLog('LAYER ' + name + ':');
                // 列出该层的 ownPropertyNames
                try {
                    var layerProps = Object.getOwnPropertyNames(subs[s]);
                    var custom = [];
                    for (var lp = 0; lp < layerProps.length; lp++) {
                        try {
                            var lpv = subs[s][layerProps[lp]];
                            if (typeof lpv === 'function') {
                                custom.push(layerProps[lp] + '(fn)');
                            } else if (typeof lpv === 'object' && lpv !== null) {
                                var subk = Object.keys(lpv).length;
                                custom.push(layerProps[lp] + '(obj:' + subk + ')');
                            }
                        } catch(e) {}
                    }
                    _speedLog('  ownProps(' + layerProps.length + '): ' + custom.slice(0, 30).join(', '));
                } catch(e) {}
                
                // 检查子节点的深层自定义属性
                try {
                    var layerChildren = subs[s].getChildren();
                    for (var lc = 0; lc < layerChildren.length && lc < 3; lc++) {
                        var lcn = '';
                        try { lcn = layerChildren[lc].getName(); } catch(e) {}
                        var lcProps = [];
                        try {
                            var lcOwnProps = Object.getOwnPropertyNames(layerChildren[lc]);
                            for (var x = 0; x < lcOwnProps.length; x++) {
                                try {
                                    var xv = layerChildren[lc][lcOwnProps[x]];
                                    if (typeof xv === 'function' || (typeof xv === 'object' && xv !== null)) {
                                        lcProps.push(lcOwnProps[x] + '(' + typeof xv + ')');
                                    }
                                } catch(e) {}
                            }
                        } catch(e) {}
                        _speedLog('  child[' + lc + '] "' + lcn + '" ownProps: ' + lcProps.slice(0,20).join(', '));
                    }
                } catch(e) {}
            }
        }
    } catch(e) {
        _speedLog('Node scan err: ' + e);
    }
    
    // ──── 方向3: 自定义事件记录 ────
    _speedLog('--- 3. CUSTOM EVENTS ---');
    // 去重
    var uniqueEvents = {};
    for (var e = 0; e < _customEvents.length; e++) {
        var ev = _customEvents[e];
        uniqueEvents[ev] = (uniqueEvents[ev] || 0) + 1;
    }
    var evList = Object.keys(uniqueEvents);
    _speedLog('Unique events: ' + evList.length);
    for (var i = 0; i < evList.length && i < 50; i++) {
        _speedLog('  ' + evList[i] + ' x' + uniqueEvents[evList[i]]);
    }
    
    // ──── 方向4: Schedule 调用记录 ────
    _speedLog('--- 4. SCHEDULE CALLS ---');
    _speedLog('Schedule calls: ' + _scheduleCalls.length);
    for (var i = 0; i < _scheduleCalls.length && i < 30; i++) {
        var sc = _scheduleCalls[i];
        _speedLog('  node="' + sc.node + '" interval=' + sc.interval + ' cb=' + (sc.cb || '').substring(0, 80));
    }
    
    _speedLog('=== PROBE v5 END ===');
}

// ============================================================
// F11 触发 — 战斗动画跳过 v2
// 策略：Hook cc.DelayTime.create + 扫描实体 action_state
// 只在战斗中生效，不影响 UI / 大厅
// ============================================================
var _animSkipEnabled = false;
var _animSkipTimer = null;
var _skipStats = { delayHooked: 0, delaySkipped: 0, entityForced: 0, spineAccel: 0 };

// ---- 战斗检测 ----
var _battleGlobals = {};  // 运行时发现的全局战斗对象
var _battleProbesDone = false;

function _probeBattleGlobals() {
    // 探测关键全局变量
    var targets = [
        'EntityManager', 'BattleStage', 'BattleLogic', 'BattleHelper',
        'SchedulerManager', 'Boost', 'AnimationHelper', 'GameDirecting',
        'BattleDataHelper', 'GameStateChecker', 'GameObjectProvider',
        'StandbyController', 'ActionManager'
    ];
    var found = [];
    for (var i = 0; i < targets.length; i++) {
        try {
            var obj = globalThis[targets[i]];
            if (obj !== undefined && obj !== null) {
                _battleGlobals[targets[i]] = obj;
                // 收集方法名
                var methods = [];
                try {
                    var proto = typeof obj === 'function' ? obj.prototype : obj;
                    var keys = Object.getOwnPropertyNames(proto || obj);
                    for (var k = 0; k < keys.length && k < 15; k++) {
                        if (typeof (proto || obj)[keys[k]] === 'function') {
                            methods.push(keys[k]);
                        }
                    }
                } catch(e2) {}
                found.push(targets[i] + '(' + typeof obj + ') methods=[' + methods.join(',') + ']');
            }
        } catch(e) {}
    }
    _speedLog('[PROBE] Found ' + found.length + '/' + targets.length + ' battle globals');
    for (var f = 0; f < found.length; f++) {
        _speedLog('  ' + found[f]);
    }
    _battleProbesDone = true;
}

function _inBattle() {
    // 检测是否在战斗场景
    try {
        var em = _battleGlobals['EntityManager'];
        if (em) {
            // EntityManager 存在且有怪物列表 → 在战斗中
            if (typeof em.getAllEntity === 'function') return true;
            if (em.monsters) return true;
        }
    } catch(e) {}
    // 备用：检查场景名
    try {
        var scene = cc.Director.getInstance().getRunningScene();
        if (scene) {
            var name = '';
            try { name = scene.getName(); } catch(e) {}
            if (name && (name.indexOf('battle') >= 0 || name.indexOf('Battle') >= 0 || name.indexOf('ingame') >= 0)) {
                return true;
            }
        }
    } catch(e) {}
    return false;
}

// ---- Hook 1: cc.DelayTime.create ----
var _origDelayTimeCreate = null;

function _hookDelayTime() {
    if (_origDelayTimeCreate) return; // 已经 hook 过
    try {
        if (cc && cc.DelayTime && cc.DelayTime.create) {
            _origDelayTimeCreate = cc.DelayTime.create;
            cc.DelayTime.create = function(duration) {
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
    } catch(e) {
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
            cc.FadeIn.create = function(duration) {
                if (_animSkipEnabled && duration > 0.02) {
                    return _origFadeInCreate.call(this, 0.001);
                }
                return _origFadeInCreate.call(this, duration);
            };
        }
        if (cc.FadeOut && cc.FadeOut.create && !_origFadeOutCreate) {
            _origFadeOutCreate = cc.FadeOut.create;
            cc.FadeOut.create = function(duration) {
                if (_animSkipEnabled && duration > 0.02) {
                    return _origFadeOutCreate.call(this, 0.001);
                }
                return _origFadeOutCreate.call(this, duration);
            };
        }
        _speedLog('[SKIP] Hooked FadeIn/FadeOut.create');
    } catch(e) {
        _speedLog('[SKIP] Fade hook err: ' + e);
    }
}

// ---- Hook 3: 实体 Spine 加速 ----
var _entityProbed = false;

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
                                } catch(e2) {}
                                if (list.length >= 3) break;
                            }
                        }
                    }
                } catch(e) {}
                if (list.length >= 3) break;
            }
        }
        
        // 方案3: Hook getEntityOfUID 来拦截实体引用
        // v15: 增加 Error().stack 检测 selectCardRSpark 调用链
        if (list.length === 0 && typeof em.getEntityOfUID === 'function' && !em._origGetEntityOfUID) {
            em._origGetEntityOfUID = em.getEntityOfUID;
            em.getEntityOfUID = function(uid) {
                var entity = em._origGetEntityOfUID.call(this, uid);
                if (entity && !_protoHooked) {
                    _speedLog('[EM-INTERCEPT] Got entity from getEntityOfUID(uid=' + uid + '), hooking prototype...');
                    _hookPrototypeFromEntity(entity);
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
                            _sparkGuardTimer = setTimeout(function() {
                                _sparkGuardActive = false;
                                _speedLog('[SPARK] <<< auto-resume after 15s timeout');
                            }, 15000);
                        }
                    } catch(e) {}
                }
                return entity;
            };
            _speedLog('[EM] Hooked getEntityOfUID as entity interceptor (v15: +stack-trace R-Spark detection)');
        }
        
    } catch(e) {
        _speedLog('[EM] collectEntities error: ' + e);
    }
    return list;
}

// v13: 从一个实体引用 hook 原型链上的关键方法
function _hookPrototypeFromEntity(entity) {
    if (_protoHooked) return;
    try {
        var proto = Object.getPrototypeOf(entity);
        var depth = 0;
        var protoChainLog = [];
        while (proto && depth < 10) {
            var ownKeys = [];
            try { ownKeys = Object.getOwnPropertyNames(proto); } catch(e) {}
            var constructorName = '';
            try { constructorName = proto.constructor ? proto.constructor.name : ''; } catch(e) {}
            protoChainLog.push('L' + depth + ':' + constructorName + '(keys=' + ownKeys.length + ')');
            
            // Hook playAnimation
            var hasPlayAnim = ownKeys.indexOf('playAnimation') >= 0;
            if (hasPlayAnim && typeof proto.playAnimation === 'function' && !_origProtoPlayAnimation) {
                _origProtoPlayAnimation = proto.playAnimation;
                proto.playAnimation = function(animName, loop) {
                    if (_animSkipEnabled && !_sparkGuardActive && !loop) {
                        _origProtoPlayAnimation.call(this, animName, loop);
                        return 0.001;
                    }
                    return _origProtoPlayAnimation.call(this, animName, loop);
                };
                _speedLog('[PROTO-DYN] Hooked playAnimation on L' + depth + ':' + constructorName);
            }
            
            // Hook showSparkEffect — v15: Object.defineProperty accessor
            // v14 的 proto.showSparkEffect = wrapper 被 V8 IC 完全绕过
            // v15: 用 Object.defineProperty 把 data property 改为 accessor property
            // V8 IC 对 accessor property 必须调用 getter，无法缓存跳过
            var hasShowSpark = ownKeys.indexOf('showSparkEffect') >= 0;
            if (hasShowSpark && typeof proto.showSparkEffect === 'function' && !_origProtoShowSparkEffect) {
                _origProtoShowSparkEffect = proto.showSparkEffect;
                try {
                    Object.defineProperty(proto, 'showSparkEffect', {
                        get: function() {
                            var self = this;
                            return function _showSparkEffect_wrapper() {
                                // v15: 诊断日志
                                if (_animSkipEnabled && _sparkCallCount < _MAX_SPARK_LOGS) {
                                    _sparkCallCount++;
                                    var a2v = arguments.length > 0 ? arguments[0] : 'N/A';
                                    _speedLog('[SPARK-CALL#' + _sparkCallCount + '] arg=' + String(a2v).substring(0, 50) + ' type=' + typeof a2v);
                                    if (_sparkCallCount <= 5) {
                                        try {
                                            var sparkKeys = ['ready_spark','ready_red_spark','spark_id','r_spark','y_spark','r_spark_candis','cards','char_id','uid'];
                                            var found = [];
                                            for (var sk = 0; sk < sparkKeys.length; sk++) {
                                                var sv = self[sparkKeys[sk]];
                                                if (sv !== undefined) found.push(sparkKeys[sk] + '=' + sv);
                                            }
                                            _speedLog('[SPARK-ENT] props: ' + (found.length > 0 ? found.join(', ') : '(none)'));
                                        } catch(e) {}
                                    }
                                }
                                var method = _detectRSpark(self, arguments);
                                if (method && _animSkipEnabled) {
                                    _sparkGuardActive = true;
                                    _speedLog('[SPARK] >>> R-SPARK GUARD ON via ' + method);
                                    if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                    _sparkGuardTimer = setTimeout(function() {
                                        _sparkGuardActive = false;
                                        _speedLog('[SPARK] <<< auto-resume after 15s timeout');
                                    }, 15000);
                                }
                                return _origProtoShowSparkEffect.apply(self, arguments);
                            };
                        },
                        configurable: true,
                        enumerable: true
                    });
                    _speedLog('[PROTO-DYN] Hooked showSparkEffect via Object.defineProperty accessor on L' + depth + ':' + constructorName);
                } catch(e) {
                    // defineProperty 失败时 fallback 到直接赋值
                    proto.showSparkEffect = function() {
                        if (_animSkipEnabled && _sparkCallCount < _MAX_SPARK_LOGS) {
                            _sparkCallCount++;
                            var a2v = arguments.length > 0 ? arguments[0] : 'N/A';
                            _speedLog('[SPARK-CALL#' + _sparkCallCount + '] arg=' + String(a2v).substring(0, 50) + ' type=' + typeof a2v);
                        }
                        var method = _detectRSpark(this, arguments);
                        if (method && _animSkipEnabled) {
                            _sparkGuardActive = true;
                            _speedLog('[SPARK] >>> R-SPARK GUARD ON via ' + method);
                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                            _sparkGuardTimer = setTimeout(function() {
                                _sparkGuardActive = false;
                            }, 15000);
                        }
                        return _origProtoShowSparkEffect.apply(this, arguments);
                    };
                    _speedLog('[PROTO-DYN] defineProperty failed (' + e + '), fallback to direct assignment on L' + depth + ':' + constructorName);
                }
            }
            
            // Hook checkSparkEffect — R-Spark 候选卡牌检查
            var hasCheckSpark = ownKeys.indexOf('checkSparkEffect') >= 0;
            if (hasCheckSpark && typeof proto.checkSparkEffect === 'function' && !_origProtoCheckSparkEffect) {
                _origProtoCheckSparkEffect = proto.checkSparkEffect;
                proto.checkSparkEffect = function() {
                    var result = _origProtoCheckSparkEffect.apply(this, arguments);
                    if (result && _animSkipEnabled) {
                        _checkSparkFlag = true;
                        _speedLog('[SPARK-CHECK] checkSparkEffect returned TRUE — R-Spark candidates exist');
                    }
                    return result;
                };
                _speedLog('[PROTO] Hooked checkSparkEffect on L' + depth + ':' + constructorName);
            }
            
            // v17: Hook showBuffEffect — Buff/CS 施加动画守卫
            var hasShowBuff = ownKeys.indexOf('showBuffEffect') >= 0;
            if (hasShowBuff && typeof proto.showBuffEffect === 'function' && !_origShowBuffEffect) {
                _origShowBuffEffect = proto.showBuffEffect;
                try {
                    Object.defineProperty(proto, 'showBuffEffect', {
                        get: function() {
                            var self = this;
                            return function _showBuffEffect_wrapper() {
                                if (_animSkipEnabled) {
                                    _buffGuardCount++;
                                    _sparkGuardActive = true;
                                    _speedLog('[BUFF-GUARD] >>> ON: showBuffEffect #' + _buffGuardCount);
                                    if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                    _sparkGuardTimer = setTimeout(function() {
                                        _sparkGuardActive = false;
                                        _speedLog('[BUFF-GUARD] <<< auto-resume 800ms');
                                    }, 800);
                                }
                                return _origShowBuffEffect.apply(self, arguments);
                            };
                        },
                        configurable: true,
                        enumerable: true
                    });
                    _speedLog('[PROTO] Hooked showBuffEffect via defineProperty on L' + depth + ':' + constructorName);
                } catch(e) {
                    proto.showBuffEffect = function() {
                        if (_animSkipEnabled) {
                            _buffGuardCount++;
                            _sparkGuardActive = true;
                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                            _sparkGuardTimer = setTimeout(function() { _sparkGuardActive = false; }, 800);
                        }
                        return _origShowBuffEffect.apply(this, arguments);
                    };
                    _speedLog('[PROTO] Hooked showBuffEffect via fallback on L' + depth + ':' + constructorName);
                }
            }
            
            // v17: Hook showDebuffEffect — Debuff 施加动画守卫
            var hasShowDebuff = ownKeys.indexOf('showDebuffEffect') >= 0;
            if (hasShowDebuff && typeof proto.showDebuffEffect === 'function' && !_origShowDebuffEffect) {
                _origShowDebuffEffect = proto.showDebuffEffect;
                try {
                    Object.defineProperty(proto, 'showDebuffEffect', {
                        get: function() {
                            var self = this;
                            return function _showDebuffEffect_wrapper() {
                                if (_animSkipEnabled) {
                                    _buffGuardCount++;
                                    _sparkGuardActive = true;
                                    _speedLog('[BUFF-GUARD] >>> ON: showDebuffEffect #' + _buffGuardCount);
                                    if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                    _sparkGuardTimer = setTimeout(function() {
                                        _sparkGuardActive = false;
                                        _speedLog('[BUFF-GUARD] <<< auto-resume 800ms');
                                    }, 800);
                                }
                                return _origShowDebuffEffect.apply(self, arguments);
                            };
                        },
                        configurable: true,
                        enumerable: true
                    });
                    _speedLog('[PROTO] Hooked showDebuffEffect via defineProperty on L' + depth + ':' + constructorName);
                } catch(e) {
                    proto.showDebuffEffect = function() {
                        if (_animSkipEnabled) {
                            _buffGuardCount++;
                            _sparkGuardActive = true;
                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                            _sparkGuardTimer = setTimeout(function() { _sparkGuardActive = false; }, 800);
                        }
                        return _origShowDebuffEffect.apply(this, arguments);
                    };
                    _speedLog('[PROTO] Hooked showDebuffEffect via fallback on L' + depth + ':' + constructorName);
                }
            }
            
            // v17: Hook showCollapseCardEffect — 崩溃卡效果动画守卫
            var hasCollapse = ownKeys.indexOf('showCollapseCardEffect') >= 0;
            if (hasCollapse && typeof proto.showCollapseCardEffect === 'function' && !_origShowCollapseCardEffect) {
                _origShowCollapseCardEffect = proto.showCollapseCardEffect;
                try {
                    Object.defineProperty(proto, 'showCollapseCardEffect', {
                        get: function() {
                            var self = this;
                            return function _showCollapseCardEffect_wrapper() {
                                if (_animSkipEnabled) {
                                    _collapseGuardCount++;
                                    _sparkGuardActive = true;
                                    _speedLog('[COLLAPSE-GUARD] >>> ON: showCollapseCardEffect #' + _collapseGuardCount);
                                    if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                    _sparkGuardTimer = setTimeout(function() {
                                        _sparkGuardActive = false;
                                        _speedLog('[COLLAPSE-GUARD] <<< auto-resume 5000ms');
                                    }, 5000);
                                }
                                return _origShowCollapseCardEffect.apply(self, arguments);
                            };
                        },
                        configurable: true,
                        enumerable: true
                    });
                    _speedLog('[PROTO] Hooked showCollapseCardEffect via defineProperty on L' + depth + ':' + constructorName);
                } catch(e) {
                    proto.showCollapseCardEffect = function() {
                        if (_animSkipEnabled) {
                            _collapseGuardCount++;
                            _sparkGuardActive = true;
                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                            _sparkGuardTimer = setTimeout(function() { _sparkGuardActive = false; }, 5000);
                        }
                        return _origShowCollapseCardEffect.apply(this, arguments);
                    };
                    _speedLog('[PROTO] Hooked showCollapseCardEffect via fallback on L' + depth + ':' + constructorName);
                }
            }
            
            // v17: Hook turnOnCollapseAura — 崩溃光环开始
            var hasCollapseOn = ownKeys.indexOf('turnOnCollapseAura') >= 0;
            if (hasCollapseOn && typeof proto.turnOnCollapseAura === 'function' && !_origTurnOnCollapseAura) {
                _origTurnOnCollapseAura = proto.turnOnCollapseAura;
                try {
                    Object.defineProperty(proto, 'turnOnCollapseAura', {
                        get: function() {
                            var self = this;
                            return function _turnOnCollapseAura_wrapper() {
                                if (_animSkipEnabled) {
                                    _collapseGuardCount++;
                                    _sparkGuardActive = true;
                                    _speedLog('[COLLAPSE-GUARD] >>> ON: turnOnCollapseAura #' + _collapseGuardCount);
                                    if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                    _sparkGuardTimer = setTimeout(function() {
                                        _sparkGuardActive = false;
                                        _speedLog('[COLLAPSE-GUARD] <<< auto-resume 5000ms (turnOn)');
                                    }, 5000);
                                }
                                return _origTurnOnCollapseAura.apply(self, arguments);
                            };
                        },
                        configurable: true,
                        enumerable: true
                    });
                    _speedLog('[PROTO] Hooked turnOnCollapseAura via defineProperty on L' + depth + ':' + constructorName);
                } catch(e) {
                    _speedLog('[PROTO] turnOnCollapseAura defineProperty failed: ' + e);
                }
            }
            
            // v17: Hook turnOffCollapseAura — 崩溃光环结束
            var hasCollapseOff = ownKeys.indexOf('turnOffCollapseAura') >= 0;
            if (hasCollapseOff && typeof proto.turnOffCollapseAura === 'function' && !_origTurnOffCollapseAura) {
                _origTurnOffCollapseAura = proto.turnOffCollapseAura;
                try {
                    Object.defineProperty(proto, 'turnOffCollapseAura', {
                        get: function() {
                            var self = this;
                            return function _turnOffCollapseAura_wrapper() {
                                if (_animSkipEnabled && _sparkGuardActive) {
                                    _speedLog('[COLLAPSE-GUARD] turnOffCollapseAura → schedule OFF 1500ms');
                                    if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                    _sparkGuardTimer = setTimeout(function() {
                                        _sparkGuardActive = false;
                                        _speedLog('[COLLAPSE-GUARD] <<< OFF via turnOffCollapseAura');
                                    }, 1500);
                                }
                                return _origTurnOffCollapseAura.apply(self, arguments);
                            };
                        },
                        configurable: true,
                        enumerable: true
                    });
                    _speedLog('[PROTO] Hooked turnOffCollapseAura via defineProperty on L' + depth + ':' + constructorName);
                } catch(e) {
                    _speedLog('[PROTO] turnOffCollapseAura defineProperty failed: ' + e);
                }
            }
            
            proto = Object.getPrototypeOf(proto);
            depth++;
        }
        _speedLog('[PROTO-DYN] entity chain: ' + protoChainLog.join(' → '));
        _protoHooked = true;
    } catch(e) {
        _speedLog('[PROTO-DYN] error: ' + e);
    }
}

function _probeFirstEntity() {
    if (_entityProbed) return;
    _entityProbed = true;
    var entities = _collectEntities();
    if (entities.length === 0) {
        _speedLog('[ENTITY] No entities found');
        return;
    }
    _speedLog('[ENTITY] Found ' + entities.length + ' entities');
    
    var ent = entities[0];
    
    // 列出 aninode 的全部方法
    try {
        var an = ent.aninode;
        if (an) {
            var allFuncs = [];
            for (var k in an) {
                if (typeof an[k] === 'function') allFuncs.push(k);
            }
            _speedLog('[ENTITY] aninode ALL funcs(' + allFuncs.length + '): ' + allFuncs.join(', '));
            
            // 搜索 speed/time/scale/duration 相关
            var speedFuncs = [];
            for (var i = 0; i < allFuncs.length; i++) {
                var fn = allFuncs[i].toLowerCase();
                if (fn.indexOf('speed') >= 0 || fn.indexOf('time') >= 0 || 
                    fn.indexOf('scale') >= 0 || fn.indexOf('rate') >= 0 ||
                    fn.indexOf('duration') >= 0 || fn.indexOf('play') >= 0 ||
                    fn.indexOf('anim') >= 0 || fn.indexOf('spine') >= 0 ||
                    fn.indexOf('skeleton') >= 0 || fn.indexOf('skip') >= 0) {
                    speedFuncs.push(allFuncs[i]);
                }
            }
            if (speedFuncs.length > 0) {
                _speedLog('[ENTITY] aninode SPEED/ANIM funcs: ' + speedFuncs.join(', '));
            }
        }
    } catch(e) {}
    
    // 递归搜索整个节点树找 setTimeScale（Spine 标志）
    _speedLog('[ENTITY] === Recursive node tree search ===');
    var spineCount = 0;
    
    function _searchNodeTree(node, path, depth) {
        if (!node || depth > 5) return;
        try {
            var name = '';
            try { name = node.getName ? node.getName() : ''; } catch(e) {}
            
            // 检查这个节点是否有 Spine 方法
            var hasTimeScale = typeof node.setTimeScale === 'function';
            var hasSetAnim = typeof node.setAnimation === 'function';
            var hasSkeleton = typeof node.findAnimation === 'function';
            
            if (hasTimeScale || hasSetAnim || hasSkeleton) {
                spineCount++;
                _speedLog('[ENTITY] SPINE FOUND at ' + path + ' "' + name + '"' +
                          ' setTimeScale=' + hasTimeScale +
                          ' setAnimation=' + hasSetAnim +
                          ' findAnimation=' + hasSkeleton);
                // 列出该节点的所有方法
                var funcs = [];
                for (var k in node) {
                    if (typeof node[k] === 'function') funcs.push(k);
                }
                _speedLog('[ENTITY]   Spine node funcs: ' + funcs.slice(0, 30).join(', '));
            }
            
            // 继续搜索子节点
            if (typeof node.getChildren === 'function') {
                var kids = node.getChildren();
                if (kids && kids.length) {
                    for (var c = 0; c < kids.length; c++) {
                        _searchNodeTree(kids[c], path + '/' + c, depth + 1);
                    }
                }
            }
        } catch(e) {}
    }
    
    // 从每个实体开始搜索
    for (var ei = 0; ei < entities.length && ei < 3; ei++) {
        var e = entities[ei];
        var ename = '';
        try { ename = e.getName ? e.getName() : ''; } catch(ex) {}
        _searchNodeTree(e, 'ent[' + ei + ']', 0);
        // 也搜索 aninode
        try {
            if (e.aninode) {
                _searchNodeTree(e.aninode, 'ent[' + ei + '].aninode', 0);
            }
        } catch(ex) {}
    }
    
    if (spineCount === 0) {
        _speedLog('[ENTITY] No Spine nodes found in tree! Animation may use AnimationNode system');
        // 尝试 aninode 的 scaleFactor 或其他方法
        try {
            var an = entities[0].aninode;
            if (an && typeof an.getScaleFactor === 'function') {
                _speedLog('[ENTITY] aninode.getScaleFactor()=' + an.getScaleFactor());
            }
        } catch(e) {}
    }
    _speedLog('[ENTITY] Spine nodes found: ' + spineCount);
}

// ---- 方案 v10: 完全吞掉攻击动画 ----
// 原理：hook setAnimation
//       非循环动画(攻击/技能) → 直接不调原始方法，保持 idle
//       循环动画(idle/stand) → 正常播放
var _hookedAnimNodes = [];
var _animLogCount = 0;
var _MAX_ANIM_LOGS = 200;
var _timerHookLog = 0; // 定时器 hook 日志计数

function _hookEntityAnimations(enable) {
    var entities = _collectEntities();
    
    if (enable) {
        var hookCount = 0;
        
        function _hookNode(node, depth, entityName) {
            if (!node || depth > 3) return;
            try {
                if (typeof node.setAnimation === 'function' && !node._setAnimHooked) {
                    node._origSetAnimation = node.setAnimation;
                    node._lastIdleAnim = null;
                    node._lastIdleTrack = 0;
                    node._entityLabel = entityName || '';
                    
                    node.setAnimation = function(track, animName, loop) {
                        // 日志
                        if (_animLogCount < _MAX_ANIM_LOGS) {
                            _animLogCount++;
                            _speedLog('[ANIM] ' + this._entityLabel + 
                                      ' t=' + track + 
                                      ' "' + animName + '"' +
                                      ' loop=' + loop +
                                      ' skip=' + (_animSkipEnabled && !loop));
                        }
                        
                        if (loop) {
                            // 循环动画(idle) → 正常播放 + 记住
                            this._lastIdleAnim = animName;
                            this._lastIdleTrack = track;
                            return this._origSetAnimation.call(this, track, animName, loop);
                        }
                        
                        if (_animSkipEnabled) {
                            // ★ 完全吞掉非循环动画 ★
                            // 不调用原始方法 → 角色保持 idle 姿态
                            // 返回 undefined（调用方通常不检查返回值）
                            return undefined;
                        }
                        
                        return this._origSetAnimation.call(this, track, animName, loop);
                    };
                    node._setAnimHooked = true;
                    _hookedAnimNodes.push(node);
                    hookCount++;
                }
            } catch(e) {}
            try {
                if (typeof node.getChildren === 'function') {
                    var kids = node.getChildren();
                    if (kids) {
                        for (var k = 0; k < kids.length; k++) {
                            _hookNode(kids[k], depth + 1, entityName);
                        }
                    }
                }
            } catch(e) {}
        }
        
        for (var i = 0; i < entities.length; i++) {
            if (!entities[i]) continue;
            var ename = '';
            try { ename = entities[i].name || entities[i].getName() || ('ent' + i); } catch(e) { ename = 'ent' + i; }
            _hookNode(entities[i], 0, ename);
            try {
                if (entities[i].aninode) _hookNode(entities[i].aninode, 0, ename + '.ani');
            } catch(e) {}
        }
        
        // 定时器日志（前10次）
        if (_timerHookLog < 10 && hookCount > 0) {
            _timerHookLog++;
            _speedLog('[TIMER] hooked ' + hookCount + ' new nodes (entities=' + entities.length + ')');
        }
        
        return hookCount;
    } else {
        var restored = 0;
        for (var i = 0; i < _hookedAnimNodes.length; i++) {
            try {
                var node = _hookedAnimNodes[i];
                if (node && node._origSetAnimation) {
                    node.setAnimation = node._origSetAnimation;
                    node._setAnimHooked = false;
                    delete node._origSetAnimation;
                    delete node._lastIdleAnim;
                    delete node._entityLabel;
                    restored++;
                }
            } catch(e) {}
        }
        _hookedAnimNodes = [];
        _animLogCount = 0;
        _timerHookLog = 0;
        return restored;
    }
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
var _sparkGuardActive = false;
var _sparkGuardTimer = null;
var _battleEventHooked = false;
var _sparkCallCount = 0;  // showSparkEffect 调用次数
var _MAX_SPARK_LOGS = 100;
var _checkSparkFlag = false;  // checkSparkEffect 返回 true 时设置
var _sparkStackLogCount = 0;  // v15: stack trace 日志计数
var _getEntityCallCount = 0;  // v15: getEntityOfUID 调用计数
// v17: Buff/Collapse guard
var _origShowBuffEffect = null;
var _origShowDebuffEffect = null;
var _origShowCollapseCardEffect = null;
var _origTurnOnCollapseAura = null;
var _origTurnOffCollapseAura = null;
var _buffGuardCount = 0;
var _collapseGuardCount = 0;

// v14: 多信号 R-Spark 检测函数 (M1-M4 仍作为 showSparkEffect accessor 的辅助检测)
// 返回检测方法名 (string) 或 false
function _detectRSpark(entity, args) {
    var a2_val = args.length > 0 ? args[0] : undefined;
    var isShow = !!a2_val;
    if (!isShow) return false;  // 移除特效的调用，不是 R-Spark
    
    // M1: entity 自身的 ready_spark (unit_card 对象可能有)
    try {
        if (entity.ready_spark || entity.ready_red_spark) return 'M1:this.ready_spark';
    } catch(e) {}
    
    // M2: 参数类型检查
    // selectCardRSpark 传递 ready_spark 数据(可能是卡牌ID/对象,非 boolean)
    // 普通 spark 传递 true/false
    try {
        if (typeof a2_val !== 'boolean' && a2_val !== 1 && a2_val !== 0) {
            return 'M2:non-boolean-arg(' + typeof a2_val + ':' + String(a2_val).substring(0, 30) + ')';
        }
    } catch(e) {}
    
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
    } catch(e) {}
    
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
    } catch(e) { return; }
    
    if (!typeStr || !_animSkipEnabled) return;
    
    // 检查是否是保护事件 (guard ON)
    if (_guardEvents.hasOwnProperty(typeStr)) {
        _sparkGuardActive = true;
        _speedLog('[GUARD] >>> ON: ' + typeStr);
        
        var duration = _guardEvents[typeStr];
        if (duration > 0) {
            // 定时自动恢复
            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
            _sparkGuardTimer = setTimeout(function() {
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
        _sparkGuardTimer = setTimeout(function() {
            _sparkGuardActive = false;
            _speedLog('[GUARD] <<< OFF: ' + typeStr + ' (delayed ' + offDelay + 'ms)');
        }, offDelay);
        _speedLog('[GUARD] <<< scheduling OFF: ' + typeStr + ' in ' + offDelay + 'ms');
    }
}

function _hookBattleEventManager() {
    if (_battleEventHooked) return;
    
    var bem = globalThis['BattleEventManager'];
    if (!bem) {
        _speedLog('[BEM] BattleEventManager not found on globalThis');
        _battleEventHooked = true;
        return;
    }
    
    // === 方案4 (v16): Object.defineProperty accessor on emit ===
    // 跟 showSparkEffect 完全一样的技术，已证明可绕过 V8 IC
    try {
        var origEmit = bem.emit;
        if (typeof origEmit === 'function') {
            Object.defineProperty(bem, 'emit', {
                get: function() {
                    return function() {
                        _bemEmitCallCount++;
                        // emit(eventType, detail, opts) — 第一个参数是事件类型字符串
                        if (arguments.length > 0 && _animSkipEnabled) {
                            _checkBemEventGuard(arguments[0]);
                            if (_bemEmitCallCount <= _MAX_BEM_LOGS) {
                                _speedLog('[BEM-EMIT#' + _bemEmitCallCount + '] type=' + String(arguments[0]));
                            }
                        }
                        return origEmit.apply(bem, arguments);
                    };
                },
                configurable: true
            });
            _speedLog('[BEM] Hooked emit via Object.defineProperty accessor ✓');
        } else {
            _speedLog('[BEM] emit not found, type=' + typeof origEmit);
        }
    } catch(e) {
        _speedLog('[BEM] emit defineProperty err: ' + e);
        // fallback: 直接赋值
        try {
            var origEmit2 = bem.emit;
            if (typeof origEmit2 === 'function') {
                bem.emit = function() {
                    _bemEmitCallCount++;
                    if (arguments.length > 0 && _animSkipEnabled) {
                        _checkBemEventGuard(arguments[0]);
                    }
                    return origEmit2.apply(bem, arguments);
                };
                _speedLog('[BEM] Hooked emit via direct assignment (fallback)');
            }
        } catch(e2) {
            _speedLog('[BEM] emit fallback err: ' + e2);
        }
    }
    
    // === 同时 hook dispatchEvent (emit 内部调用 dispatchEvent) ===
    try {
        var origDispatch = bem.dispatchEvent;
        if (typeof origDispatch === 'function') {
            Object.defineProperty(bem, 'dispatchEvent', {
                get: function() {
                    return function(event) {
                        _bemDispatchCallCount++;
                        // dispatchEvent 的参数是 EventBase 对象，有 .type 属性
                        if (event && _animSkipEnabled) {
                            _checkBemEventGuard(event);
                            if (_bemDispatchCallCount <= 20) {
                                var evType = '';
                                try { evType = event.type || String(event); } catch(e) {}
                                _speedLog('[BEM-DISPATCH#' + _bemDispatchCallCount + '] event.type=' + evType);
                            }
                        }
                        return origDispatch.apply(bem, arguments);
                    };
                },
                configurable: true
            });
            _speedLog('[BEM] Hooked dispatchEvent via Object.defineProperty accessor ✓');
        }
    } catch(e) {
        _speedLog('[BEM] dispatchEvent defineProperty err: ' + e);
    }
    
    // === 同时 hook emitAsync 和 emitSequence ===
    var asyncMethods = ['emitAsync', 'emitSequence'];
    for (var i = 0; i < asyncMethods.length; i++) {
        (function(methodName) {
            try {
                var origMethod = bem[methodName];
                if (typeof origMethod === 'function') {
                    Object.defineProperty(bem, methodName, {
                        get: function() {
                            return function() {
                                if (arguments.length > 0 && _animSkipEnabled) {
                                    _checkBemEventGuard(arguments[0]);
                                }
                                return origMethod.apply(bem, arguments);
                            };
                        },
                        configurable: true
                    });
                    _speedLog('[BEM] Hooked ' + methodName + ' via accessor ✓');
                }
            } catch(e) {
                _speedLog('[BEM] ' + methodName + ' hook err: ' + e);
            }
        })(asyncMethods[i]);
    }
    
    // === 保留: addCustomEventListener 注册 (作为双重保险) ===
    try {
        var disp = cc.Director.getInstance().getEventDispatcher();
        if (disp && disp.addCustomEventListener) {
            var sparkEvents = ['ON_SPARK_START', 'ON_SPARK_END'];
            for (var s = 0; s < sparkEvents.length; s++) {
                (function(evName) {
                    try {
                        disp.addCustomEventListener(evName, function() {
                            if (evName.indexOf('START') >= 0) {
                                _sparkGuardActive = true;
                                _speedLog('[SPARK-CC] >>> ' + evName);
                            } else if (evName.indexOf('END') >= 0) {
                                setTimeout(function() { 
                                    _sparkGuardActive = false;
                                    _speedLog('[SPARK-CC] <<< guard off');
                                }, 1500);
                            }
                        });
                    } catch(e) {}
                })(sparkEvents[s]);
            }
            _speedLog('[SPARK] Registered addCustomEventListener for spark events');
        }
    } catch(e) {}
    
    _battleEventHooked = true;
}

function _hookEntityPlayAnimation(enable) {
    var entities = _collectEntities();
    
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
                    try { ownKeys = Object.getOwnPropertyNames(proto); } catch(e) {}
                    var hasPlayAnim = ownKeys.indexOf('playAnimation') >= 0;
                    var constructorName = '';
                    try { constructorName = proto.constructor ? proto.constructor.name : ''; } catch(e) {}
                    protoChainLog.push('L' + depth + ':' + constructorName + 
                                       '(keys=' + ownKeys.length + 
                                       ',playAnim=' + hasPlayAnim + ')');
                    
                    if (hasPlayAnim && typeof proto.playAnimation === 'function' && !_origProtoPlayAnimation) {
                        _origProtoPlayAnimation = proto.playAnimation;
                        proto.playAnimation = function(animName, loop) {
                            if (_playAnimLogCount < _MAX_PLAY_LOGS) {
                                _playAnimLogCount++;
                                var label = '';
                                try { label = this.getName ? this.getName() : ''; } catch(e) {}
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
                                get: function() {
                                    var self = this;
                                    return function _showSparkEffect_hook() {
                                        if (_animSkipEnabled && _sparkCallCount < _MAX_SPARK_LOGS) {
                                            _sparkCallCount++;
                                            var a2v = arguments.length > 0 ? arguments[0] : 'N/A';
                                            _speedLog('[SPARK-CALL#' + _sparkCallCount + '] arg=' + String(a2v).substring(0, 50) + ' type=' + typeof a2v);
                                        }
                                        var method = _detectRSpark(self, arguments);
                                        if (method && _animSkipEnabled) {
                                            _sparkGuardActive = true;
                                            _speedLog('[SPARK] >>> R-SPARK GUARD ON via ' + method);
                                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                            _sparkGuardTimer = setTimeout(function() {
                                                _sparkGuardActive = false;
                                            }, 15000);
                                        }
                                        return _origProtoShowSparkEffect.apply(self, arguments);
                                    };
                                },
                                configurable: true,
                                enumerable: true
                            });
                        } catch(e) {
                            proto.showSparkEffect = function() {
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
                        proto.checkSparkEffect = function() {
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
                    
                    // === v17: Hook showBuffEffect — Buff 动画守卫 ===
                    var hasShowBuff2 = ownKeys.indexOf('showBuffEffect') >= 0;
                    if (hasShowBuff2 && typeof proto.showBuffEffect === 'function' && !_origShowBuffEffect) {
                        _origShowBuffEffect = proto.showBuffEffect;
                        try {
                            Object.defineProperty(proto, 'showBuffEffect', {
                                get: function() {
                                    var self = this;
                                    return function() {
                                        if (_animSkipEnabled) {
                                            _buffGuardCount++;
                                            _sparkGuardActive = true;
                                            _speedLog('[BUFF-GUARD] >>> ON: showBuffEffect #' + _buffGuardCount);
                                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                            _sparkGuardTimer = setTimeout(function() {
                                                _sparkGuardActive = false;
                                                _speedLog('[BUFF-GUARD] <<< auto-resume 800ms');
                                            }, 800);
                                        }
                                        return _origShowBuffEffect.apply(self, arguments);
                                    };
                                },
                                configurable: true,
                                enumerable: true
                            });
                        } catch(e) {
                            proto.showBuffEffect = function() {
                                if (_animSkipEnabled) {
                                    _buffGuardCount++;
                                    _sparkGuardActive = true;
                                    if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                    _sparkGuardTimer = setTimeout(function() { _sparkGuardActive = false; }, 800);
                                }
                                return _origShowBuffEffect.apply(this, arguments);
                            };
                        }
                        hookCount++;
                        _speedLog('[PROTO] Hooked showBuffEffect on L' + depth + ':' + constructorName);
                    }
                    
                    // === v17: Hook showDebuffEffect — Debuff 动画守卫 ===
                    var hasShowDebuff2 = ownKeys.indexOf('showDebuffEffect') >= 0;
                    if (hasShowDebuff2 && typeof proto.showDebuffEffect === 'function' && !_origShowDebuffEffect) {
                        _origShowDebuffEffect = proto.showDebuffEffect;
                        try {
                            Object.defineProperty(proto, 'showDebuffEffect', {
                                get: function() {
                                    var self = this;
                                    return function() {
                                        if (_animSkipEnabled) {
                                            _buffGuardCount++;
                                            _sparkGuardActive = true;
                                            _speedLog('[BUFF-GUARD] >>> ON: showDebuffEffect #' + _buffGuardCount);
                                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                            _sparkGuardTimer = setTimeout(function() {
                                                _sparkGuardActive = false;
                                                _speedLog('[BUFF-GUARD] <<< auto-resume 800ms');
                                            }, 800);
                                        }
                                        return _origShowDebuffEffect.apply(self, arguments);
                                    };
                                },
                                configurable: true,
                                enumerable: true
                            });
                        } catch(e) {
                            proto.showDebuffEffect = function() {
                                if (_animSkipEnabled) {
                                    _buffGuardCount++;
                                    _sparkGuardActive = true;
                                    if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                    _sparkGuardTimer = setTimeout(function() { _sparkGuardActive = false; }, 800);
                                }
                                return _origShowDebuffEffect.apply(this, arguments);
                            };
                        }
                        hookCount++;
                        _speedLog('[PROTO] Hooked showDebuffEffect on L' + depth + ':' + constructorName);
                    }
                    
                    // === v17: Hook showCollapseCardEffect — 崩溃卡效果守卫 ===
                    var hasCollapse2 = ownKeys.indexOf('showCollapseCardEffect') >= 0;
                    if (hasCollapse2 && typeof proto.showCollapseCardEffect === 'function' && !_origShowCollapseCardEffect) {
                        _origShowCollapseCardEffect = proto.showCollapseCardEffect;
                        try {
                            Object.defineProperty(proto, 'showCollapseCardEffect', {
                                get: function() {
                                    var self = this;
                                    return function() {
                                        if (_animSkipEnabled) {
                                            _collapseGuardCount++;
                                            _sparkGuardActive = true;
                                            _speedLog('[COLLAPSE-GUARD] >>> ON: showCollapseCardEffect #' + _collapseGuardCount);
                                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                            _sparkGuardTimer = setTimeout(function() {
                                                _sparkGuardActive = false;
                                                _speedLog('[COLLAPSE-GUARD] <<< auto-resume 5000ms');
                                            }, 5000);
                                        }
                                        return _origShowCollapseCardEffect.apply(self, arguments);
                                    };
                                },
                                configurable: true,
                                enumerable: true
                            });
                        } catch(e) {
                            proto.showCollapseCardEffect = function() {
                                if (_animSkipEnabled) {
                                    _collapseGuardCount++;
                                    _sparkGuardActive = true;
                                    if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                    _sparkGuardTimer = setTimeout(function() { _sparkGuardActive = false; }, 5000);
                                }
                                return _origShowCollapseCardEffect.apply(this, arguments);
                            };
                        }
                        hookCount++;
                        _speedLog('[PROTO] Hooked showCollapseCardEffect on L' + depth + ':' + constructorName);
                    }
                    
                    // === v17: Hook turnOnCollapseAura — 崩溃光环开始 ===
                    var hasCollapseOn2 = ownKeys.indexOf('turnOnCollapseAura') >= 0;
                    if (hasCollapseOn2 && typeof proto.turnOnCollapseAura === 'function' && !_origTurnOnCollapseAura) {
                        _origTurnOnCollapseAura = proto.turnOnCollapseAura;
                        try {
                            Object.defineProperty(proto, 'turnOnCollapseAura', {
                                get: function() {
                                    var self = this;
                                    return function() {
                                        if (_animSkipEnabled) {
                                            _collapseGuardCount++;
                                            _sparkGuardActive = true;
                                            _speedLog('[COLLAPSE-GUARD] >>> ON: turnOnCollapseAura #' + _collapseGuardCount);
                                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                            _sparkGuardTimer = setTimeout(function() {
                                                _sparkGuardActive = false;
                                                _speedLog('[COLLAPSE-GUARD] <<< auto-resume 5000ms');
                                            }, 5000);
                                        }
                                        return _origTurnOnCollapseAura.apply(self, arguments);
                                    };
                                },
                                configurable: true,
                                enumerable: true
                            });
                        } catch(e) {}
                        hookCount++;
                        _speedLog('[PROTO] Hooked turnOnCollapseAura on L' + depth + ':' + constructorName);
                    }
                    
                    // === v17: Hook turnOffCollapseAura — 崩溃光环结束 ===
                    var hasCollapseOff2 = ownKeys.indexOf('turnOffCollapseAura') >= 0;
                    if (hasCollapseOff2 && typeof proto.turnOffCollapseAura === 'function' && !_origTurnOffCollapseAura) {
                        _origTurnOffCollapseAura = proto.turnOffCollapseAura;
                        try {
                            Object.defineProperty(proto, 'turnOffCollapseAura', {
                                get: function() {
                                    var self = this;
                                    return function() {
                                        if (_animSkipEnabled && _sparkGuardActive) {
                                            _speedLog('[COLLAPSE-GUARD] turnOffCollapseAura → schedule OFF 1500ms');
                                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                            _sparkGuardTimer = setTimeout(function() {
                                                _sparkGuardActive = false;
                                                _speedLog('[COLLAPSE-GUARD] <<< OFF via turnOffCollapseAura');
                                            }, 1500);
                                        }
                                        return _origTurnOffCollapseAura.apply(self, arguments);
                                    };
                                },
                                configurable: true,
                                enumerable: true
                            });
                        } catch(e) {}
                        hookCount++;
                        _speedLog('[PROTO] Hooked turnOffCollapseAura on L' + depth + ':' + constructorName);
                    }
                    
                    proto = Object.getPrototypeOf(proto);
                    depth++;
                }
                _speedLog('[PROTO] entity chain: ' + protoChainLog.join(' → '));
            } catch(e) {
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
                        try { ownKeys = Object.getOwnPropertyNames(proto); } catch(e) {}
                        var hasSetAnim = ownKeys.indexOf('setAnimation') >= 0;
                        var hasGetLen = ownKeys.indexOf('getAnimationLength') >= 0;
                        var constructorName = '';
                        try { constructorName = proto.constructor ? proto.constructor.name : ''; } catch(e) {}
                        aniProtoLog.push('L' + depth + ':' + constructorName + 
                                         '(setAnim=' + hasSetAnim + 
                                         ',getLen=' + hasGetLen + ')');
                        
                        // Hook setAnimation on prototype
                        if (hasSetAnim && typeof proto.setAnimation === 'function' && !_origProtoSetAnimation) {
                            _origProtoSetAnimation = proto.setAnimation;
                            proto.setAnimation = function(track, animName, loop) {
                                if (_playAnimLogCount < _MAX_PLAY_LOGS) {
                                    _playAnimLogCount++;
                                    var label = '';
                                    try { label = this.getName ? this.getName() : ''; } catch(e) {}
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
                            proto.getAnimationLength = function(animName) {
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
            } catch(e) {
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
            } catch(e) {}
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
            } catch(e) {}
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
            } catch(e) {}
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
                        } catch(e2) {
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
            } catch(e) {}
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
            globalThis['timeSleep'] = function(ms) {
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
    } catch(e) {
        _speedLog('[SKIP] timeSleep hook err: ' + e);
    }
    
    // Hook waitForNextFrame — 用 setTimeout(1ms) 代替等下一帧
    // 之前担心死循环，但 setTimeout 会 yield 到事件循环，不会阻塞
    // 原始等待 ~16ms/帧，现在 ~1ms → 轮询循环快 16 倍
    try {
        var wnf = globalThis['waitForNextFrame'];
        if (wnf && typeof wnf === 'function' && !_origWaitForNextFrame) {
            _origWaitForNextFrame = wnf;
            globalThis['waitForNextFrame'] = function() {
                if (_animSkipEnabled && !_sparkGuardActive) {
                    return new Promise(function(resolve) {
                        setTimeout(resolve, 0);
                    });
                }
                return _origWaitForNextFrame();
            };
            _speedLog('[SKIP] Hooked waitForNextFrame → setTimeout(0)');
        } else {
            _speedLog('[SKIP] waitForNextFrame: type=' + typeof wnf);
        }
    } catch(e) {
        _speedLog('[SKIP] waitForNextFrame hook err: ' + e);
    }

    // Hook waitForNextFrames 同理
    try {
        var wnfs = globalThis['waitForNextFrames'];
        if (wnfs && typeof wnfs === 'function' && !_origWaitForNextFrames) {
            _origWaitForNextFrames = wnfs;
            globalThis['waitForNextFrames'] = function(n) {
                if (_animSkipEnabled && !_sparkGuardActive) {
                    return new Promise(function(resolve) {
                        setTimeout(resolve, 0);
                    });
                }
                return _origWaitForNextFrames(n);
            };
            _speedLog('[SKIP] Hooked waitForNextFrames → setTimeout(0)');
        }
    } catch(e) {}
    
    // 也探测 SimpleWait（之前的目标）
    try {
        var sw = globalThis['SimpleWait'];
        if (sw && typeof sw === 'function') {
            var origSW = sw;
            globalThis['SimpleWait'] = function(ms) {
                if (_animSkipEnabled && !_sparkGuardActive && ms > 16) {
                    return origSW(1);
                }
                return origSW(ms);
            };
            _speedLog('[SKIP] Hooked globalThis.SimpleWait');
        }
    } catch(e) {}
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
        _buffGuardCount = 0;
        _collapseGuardCount = 0;
        
        // 首次开启时探测+安装 hooks  
        if (!_battleProbesDone) {
            _probeBattleGlobals();
        }
        _hookDelayTime();
        _hookFadeAnimations();
        _hookTimeSleep();
        
        // 深度探测实体结构（首次）
        _probeFirstEntity();
        
        // Hook 战斗实体的 playAnimation + getAnimationLength (v11)
        var hookCount = _hookEntityPlayAnimation(true);
        _speedLog('[SKIP] Hooked playAnimation+getAnimLen on ' + hookCount + ' targets');
        
        // === v13: Hook BattleEventManager for spark guard ===
        _hookBattleEventManager();
        
        // 定时器持续 hook 新实体
        if (_entityTimer) clearInterval(_entityTimer);
        _entityTimer = setInterval(function() {
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
                  ' buffGuard=' + _buffGuardCount +
                  ' collapseGuard=' + _collapseGuardCount +
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
        
        // Dump 所有收集到的事件（去重）
        var uniqueEvents = {};
        for (var i = 0; i < _customEvents.length; i++) {
            var ev = String(_customEvents[i]);
            uniqueEvents[ev] = (uniqueEvents[ev] || 0) + 1;
        }
        var evList = Object.keys(uniqueEvents);
        _speedLog('[EVT-DUMP] Total events: ' + _customEvents.length + ', unique: ' + evList.length);
        for (var i = 0; i < evList.length; i++) {
            _speedLog('[EVT-DUMP]   ' + evList[i] + ' x' + uniqueEvents[evList[i]]);
        }
        _customEvents = [];
        
        _sparkGuardActive = false;
    }
    
    _updateSpeedLabel();
}


function _tryAttachSpeedButton() {
    if (_speedCreateFailed) return;
    try {
        var scene = cc.Director.getInstance().getRunningScene();
        if (!scene) return;
        var btn = _createSpeedButton();
        if (!btn) return;
        var parent = null;
        try { parent = btn.getParent(); } catch(e) {}
        if (!parent) {
            scene.addChild(btn, 99999);
            _updateSpeedLabel();
            _speedLog('Attached to scene');
        }
        // 按钮已在场景中，启动 Keep-Alive Action
        _startGlobalKeepAlive(btn);
    } catch(e) {
        _speedLog('ERROR attaching: ' + e);
    }
}

_installProbeHooks();
_speedLog('Initialized. F9=加速(2x>3x>5x) F10=重置(1x) F11=综合探测');

// _director_after_draw는 매우 자주 호출되므로 특별한 성능 측정 적용
let _director_after_draw_slow_count = 0;
const _original_director_after_draw = function()
{
	const patch_error = _getenv('patch.error')
	const patch_request = _getenv('patch.request')
	if (patch_request) {
		console.log('patch_request : ', patch_request)
		_setenv('patch.request', '')
	}
	if( global.pre.pause_director_after_draw ) {

	} else if (patch_error) {
		let errorMessage = PreTexts.getText('patch_error') + '\n' + patch_error;
		if (patch_error.indexOf('E20114') !== -1) {
			errorMessage = PreTexts.getText('disk_space_error');
		}
		TitleScenePre.showNoticePopup(errorMessage)
		global.pre.pause_director_after_draw = true
	} else {
		const patch_status = _getenv( 'patch.status' )
		if( !global.pre.is_load_application_resources && 'complete' == patch_status ){
			if(first_notice_after_patch) {
				process_next_notice_after_patch()
				first_notice_after_patch = false
			}
		}
		else if ( 'ask_download' == patch_status )
		{
			if (!is_waiting_for_user_action) {
				_ad_custom_event('singular','cdn_update_popup_shown', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
				is_waiting_for_user_action = true
				const download_total = _getenv("patch.download_total")
				const download_complete = _getenv("patch.download_complete")
				const download_kb = (download_total - download_complete) / 1024
				console.log('download_total : ', download_total, ' download_complete : ', download_complete, ' download_kb : ', download_kb)
				TitleScenePre.showConfirmDownloadPopup(download_kb, function(result) {
					console.log('ask_download result : ', result)
					if (result == true) {
						console.log('ask_download result : true, start downloading')
						_ad_custom_event('singular','cdn_update_popup_check_yes', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
						_setenv( 'patch.status', 'downloading' )
						TitleScenePre.setPreButtonCallback(undefined)
					} else {
						console.log('ask_download result : false, cancel downloading')
						_ad_custom_event('singular','cdn_update_popup_check_no', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
						_setenv( 'patch.status', 'cancel' )
						TitleScenePre.setPreButtonCallback(function() {
							console.log('starting patch again')
							TitleScenePre.setPreButtonCallback(undefined)
							TitleScenePre.startPatch()
						})
					}
					is_waiting_for_user_action = false
				}, global.pre.is_pre_patch)
			}
		}
		else
		{
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


	return result;
}
global._director_after_draw = _director_after_draw

function _original_display_guide_good_game_use()
{
	console.log( ' display_guide_good_game_use ')

	let winSize = cc.Director.getInstance().getWinSize()
	let spr_guide   = cc.CSLoader.createNode( 'ui/guide_good_game.csb' )

	if( _get_cocos_refid( spr_guide ) ) {
		spr_guide.setOpacity( 0 )
		ResolutionHandler.getInstance().alignCenter(spr_guide);
		global.pre.pre_layer.addChild( spr_guide )

		console.log( '_display_guide_good_game_use' , winSize.width )

		let act_logo = cc.Sequence.create(
			cc.DelayTime.create( 0.3 ),
			cc.FadeIn.create( 0.5 ) ,
			cc.DelayTime.create( 3. ),
			cc.CallFunc.create( function() {
				_display_logo()
			} ),
			cc.CallFunc.create( function(){ global.pre.pre_layer.setColor( new cc.Color( 255, 255, 255 ) ) }),
			cc.FadeOut.create( 0.5 ),
			cc.RemoveSelf.create()
		)
		spr_guide.runAction( act_logo )
	}
	else {
		console.error( 'not found ui/guide_good_game.csb' )
		_display_logo()
	}
}

const _display_guide_good_game_use = measurePerformance(_original_display_guide_good_game_use, '_display_guide_good_game_use');

function _original_display_engine()
{
	console.log( 'display engine ')

	let winSize = cc.Director.getInstance().getWinSize()
	let spr_engine   = cc.CSLoader.createNode( 'ui/engine.csb' )

	spr_engine.setOpacity( 0 )
	ResolutionHandler.getInstance().alignCenter(spr_engine);
	global.pre.pre_layer.addChild( spr_engine )

	let eff = bootres.get_effect(  'logo_yuna' )
	if( eff ) {
		spr_engine.getChildByName( 'n_engine' ).addChild( eff )

		let act_engine = cc.Sequence.create(
			cc.DelayTime.create( 0.3 ) ,
			cc.CallFunc.create( function(){ eff.setAnimation( 0, 'animation', false ) } ),
			cc.FadeIn.create( 0.2 ),
			cc.DelayTime.create( 1.7 ) ,
			cc.CallFunc.create( function(){ _start_title_scene() }),
			cc.FadeOut.create( 0.3 ),
			cc.RemoveSelf.create()
		)
		spr_engine.runAction( act_engine )
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
	if(region == undefined || region == "ja") {
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
			if(random_char_id != undefined) {
				const voice_bank_file = `sound/${random_char_id}_voc_${region}.bank`;
				if(!ccexp.SoundEngine.getInstance().isBankLoaded(voice_bank_file)) {
					const fmod_result = ccexp.SoundEngine.getInstance().loadBankFile(voice_bank_file);
    				console.log(`LOG ~ _play_title_voice ~ voice_bank_file : ${voice_bank_file}, load result: ${fmod_result}`)
				}else {
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

const _original_display_rating = function()
{
	let winSize = cc.Director.getInstance().getWinSize()
	let rating_node = cc.CSLoader.createNode( 'ui/title_rating.csb' )
	rating_node.setOpacity( 0 )
	ResolutionHandler.getInstance().alignCenter(rating_node);

	global.pre.pre_layer.addChild( rating_node )

	console.log( '_display_rating' , winSize.width )

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
		cc.DelayTime.create( 0.3 ),
		cc.FadeIn.create( 0.5 ) ,
		cc.DelayTime.create( 2.5 ),
		cc.CallFunc.create( function() {
			_display_logo()
		} ),
		cc.CallFunc.create( function(){ global.pre.pre_layer.setColor( new cc.Color( 255, 255, 255 ) ) }),
		cc.FadeOut.create( 0.5 ),
		cc.RemoveSelf.create()
	)
	rating_node.runAction( act_logo )
};
const _display_rating = measurePerformance(_original_display_rating, '_display_rating');

const _original_display_logo = function()
{
    _play_title_voice();

	let winSize = cc.Director.getInstance().getWinSize()
	let spr_logo = cc.CSLoader.createNode( 'ui/logo.csb' , function(e) {console.log( e.getName() )} )
	spr_logo.setOpacity( 0 )
	ResolutionHandler.getInstance().alignCenter(spr_logo);
	global.pre.pre_layer.addChild( spr_logo )

	console.log( '_display_logo' , winSize.width )

	const n_right = spr_logo.getChildByName('right')
	n_right.setVisible(false);

	let n_logos = spr_logo.getChildByName( 'n_logos' )
	n_logos.setScale( 0.735 )

	n_logos.runAction( cc.Sequence.create( cc.DelayTime.create( 0.6 ), cc.EaseOut.create( cc.ScaleTo.create( 1, 0.75 ), 2 ) ) )

	let act_logo_in = cc.Sequence.create(
		cc.DelayTime.create( 0.3 ),
		cc.FadeIn.create( 0.5 ) ,
		cc.DelayTime.create( 1.4 ),
		cc.CallFunc.create( function() {
			_ad_custom_event('singular','czn_splash_screen_end', '0', '', '')
			spr_logo.stopAllActions()
			let act_logo_out = cc.Sequence.create(
				cc.CallFunc.create( function(){ global.pre.pre_layer.setColor( new cc.Color( 0, 0, 0 ) ) }),
				cc.FadeOut.create( 0.5 ),
				cc.CallFunc.create( function(){
					TitleScenePre.start();
				}),
				cc.RemoveSelf.create()
			)
			spr_logo.runAction( act_logo_out )
		}),
	)
	spr_logo.runAction( act_logo_in )

	_ad_custom_event('singular','czn_splash_screen_start', '0', '', '')

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

function _get_version_json()
{
	try
	{
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
		return JSON.parse( _getenv('verinfo.data', "{}") )
	}catch(error) {
		console.error('verinfo.data is empty : ' , error )
	}
	return {}
}
globalThis._get_version_json = _get_version_json;

function _load_remote_environment_and_prefetch() 
{
	console.log('🚀 [EARLY FETCH] Starting native remote environment load immediately...')
	global.pre.early_fetch_promise = new Promise(function(resolve) {
		_async_load_remote_environment(function(result) {
							
			if( result ){					
				if( `${_getenv( 'xcent.dolphin', 0 )}` != "1" ) {
					try{
						const version_json = _get_version_json()

						const target_version_json = EntryUtil.getTargetVersionInfo(version_json)
						const stringified_target_version_json = JSON.stringify(target_version_json)
						//console.log('target_version_json : ', stringified_target_version_json)
						_load_json_environment(stringified_target_version_json)
						//prefetch 때 멈춤
						_setenv("patch.should", "prefetch");
						_start_patch();	
					}catch(error){						
						//에러나면 포기	
						console.error("_load_remote_environment_and_prefetch error : ", error)
					}
				}					
			}
			resolve(result)
		})
	})	
}

const _original_application_start_contents = function( event )
{
	// _js_start_profile();

	
	_perf_gem_post_step_event('login', 0, 0, 0, 'success', '', false, false)
	console.log( '_application_start_contents ' + typeof( event ) , event.getEventListener() )
	cc.Director.getInstance().getEventDispatcher().removeEventListener( event.getEventListener() )

	global.pre = {}
	Util._event_listeners = {}
	_setenv("patch.status", "");

	// ⭐ [EARLY FETCH] 가장 먼저 네이티브 통신 시작 (Risk 최소화 버전)
	_load_remote_environment_and_prefetch();


	console.log( 'application_start_contents initialized' )

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

    let cocosScene      = cc.Scene.create()
	//_async_load_version_info()
	//print( 'create background layer ' )
	global.pre.pre_layer = cc.LayerColor.create( new cc.Color( 255, 255, 255 , 255 ) )
	cocosScene.bg_layer = global.pre.pre_layer
	cocosScene.addChild( global.pre.pre_layer )

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

	cc.Director.getInstance().runWithScene( cocosScene )

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


cc.Director.getInstance().getEventDispatcher().addCustomEventListener( 'application_start_contents' , _application_start_contents )

