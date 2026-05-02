'use strict';

Object.defineProperty(exports, "__esModule", { value: true });

const bootres = require( './bootres.js' )
const { PreTexts } = require( './pre_data.js' )
const { TitleBackground } = require( './bgani.js' )
const { TitleBlockPopup, TitleOptionSelectPopup, TitleConfirmPopup, TitleConfirmDownloadPopup, TitlePermissionPopup } = require( './title_popups.js' )
const { Util } = require( './util.js' )
const { EntryUtil } = require( './entry_util.js' )
const { PubStove } = require( './publisher_stove.js' )
const { PubXcent } = require( './publisher_xcent.js' )
const { ResolutionHandler } = require('./resolution.js');

const BUTTON_BAR_STATE = Object.freeze({
	HIDDEN: 0,
	AFTER_INITIALIZE: 1,
	AFTER_PATCH_COMPLETE: 2,
});

// 성능 측정 유틸리티 함수
function createPerformanceProxy(target, className) {
	return new Proxy(target, {
		get(obj, prop) {
			const value = obj[prop];
			if (typeof value === 'function') {
				return function(...args) {
					const startTime = Date.now();
					const result = value.apply(this, args);
					
					// Promise인 경우 (async 함수)
					if (result && typeof result.then === 'function') {
						return result.then((res) => {
							const executionTime = Date.now() - startTime;
							if (executionTime > 100) {
								console.log(`[PERFORMANCE] ${className}.${prop}() took ${executionTime}ms (over 0.1 second)`);
							}
							return res;
						}).catch((err) => {
							const executionTime = Date.now() - startTime;
							if (executionTime > 100) {
								console.log(`[PERFORMANCE] ${className}.${prop}() took ${executionTime}ms (over 0.1 second) - failed with error: ${err}`);
							}
							throw err;
						});
					} else {
						// 일반 함수
						const executionTime = Date.now() - startTime;
						if (executionTime > 100) {
							console.log(`[PERFORMANCE] ${className}.${prop}() took ${executionTime}ms (over 0.1 second)`);
						}
						return result;
					}
				};
			}
			return value;
		}
	});
}

class TitleScenePre
{	
	constructor()
	{
		this._selectedWorld = Util.getSelectedWorld()
		this._selectedVoice = Util.getSelectedVoice()
		this._patchUIShow = false
		this._patchingRateEventFired = { 25: false, 50: false, 75: false, 100: false };
		this._titleBackground = new TitleBackground()
		this.scene = undefined
		this.ctrls = {}
		this.publisher_string = Util.getPublisher()
		TitleScenePre.publisher = undefined;

		if (this.publisher_string == "stove") {
			TitleScenePre.publisher = new PubStove();
		} 
		else if (this.publisher_string == "xcent") {
			TitleScenePre.publisher = new PubXcent();
		}
		else {
			TitleScenePre.publisher = undefined;
		}

		// 성능 모니터링을 위한 프록시 적용
		return createPerformanceProxy(this, 'TitleScenePre');
	}

	show( parent )
	{
		const self = this;
		if( _get_cocos_refid( this.scene ) )
		{
			console.log('show title scene attach to parent')
			this.scene.ejectFromParent()
			parent.addChild( this.scene )
		}
		console.log('selectedWorld : ', this._selectedWorld)
		this.is_world_user_selected = Util.isWorldUserSelected()
		console.log('is_world_user_selected : ', this.is_world_user_selected)
		Util.setSelectedWorld(this._selectedWorld)
		
		const patch_enable = `${_getenv("patch.enable")}`
		this.is_patch_enable = patch_enable == "true"
		const local_patch_version = _patchpack_version("*");
		this.is_first_patch = local_patch_version == 0 && this.is_patch_enable;
		console.log('is_first_patch : ', this.is_first_patch)
		if (this.is_first_patch && this.publisher_string != "xcent") {
			console.log('spr_title hide when first patch')
			this.ctrls.spr_title.setVisible(false);
		} else {
			this.ctrls.spr_title.setVisible(true);
            let act_engine = cc.Sequence.create(
                cc.DelayTime.create( 1 ) ,
                cc.CallFunc.create( function(){ self.ctrls.spr_title.start() } ),
				cc.CallFunc.create( function(){ 
					if (self.publisher_string == "xcent") {
						return;
					}
				}),
            )
            this.ctrls.spr_title.runAction( act_engine )
		}
		this.updateButtonBarState(BUTTON_BAR_STATE.HIDDEN);
	}

	hide()
	{
		if( _get_cocos_refid( this.scene ) )
		{
			this.scene.removeFromParent()
		}
		this.scene = undefined
	}

	showPatchUI(visible)
	{
		this._patchUIShow = visible
	}

	startVideo()
	{
		this._titleBackground.createScene()
		this._titleBackground.show(this.scene)
		this._titleBackground.moviePlay(this.is_first_patch)
	}

	stopVideo()
	{
		this._titleBackground.hide()
	}

    changeVideoVolume(volume ) {
        if (this._titleBackground.video_player && _get_cocos_refid(this._titleBackground.video_player)) {
            this._titleBackground.video_player.setVolume(volume)
        }
    }

	/**
	 * 패치 진행률 UI 요소 표시/숨김 제어
	 * @param {boolean} visible - true: 표시, false: 숨김
	 * @param {boolean} showProgressBar - 진행바 표시 여부 (기본값: true)
	 */
	setProgressUIVisible(visible, showProgressBar = true)
	{
		// 좌우 패널
		this.ctrls.pre_left.setVisible(visible)
		this.ctrls.pre_right.setVisible(visible)
		
		// 진행바 (옵션)
		if (showProgressBar) {
			this.ctrls.progress_total.setVisible(visible)
			this.ctrls.progress_bg.setVisible(visible)
		}
		
		// 점 애니메이션 (다운로드 중 표시)
		if (!visible) {
			// 숨길 때는 모든 점을 숨김
			this.ctrls.deco_on_1.setVisible(false)
			this.ctrls.deco_on_2.setVisible(false)
			this.ctrls.deco_on_3.setVisible(false)
		}
		// 점 애니메이션은 각 update 함수에서 개별 제어
		
		// 메시지 초기화 (숨길 때만)
		if (!visible) {
			this.setMessage('', '')
		}
	}

	/**
	 * 패치 다운로드 진행 상태 UI 업데이트
	 * - 패치 파일 다운로드 중일 때 호출됨
	 * - 진행률, 다운로드 용량, 애니메이션 효과 표시
	 * - 광고 이벤트 발송 (25%, 50%, 75%, 100% 시점)
	 */
	updateProgressPatchData(patch_status)
	{
		const self = this;
		const is_dolphin = `${_getenv( 'xcent.dolphin', 0 )}` == "1"

		// 진행 상태 초기화
		let patching_progress_text = '-'
		let patching_rate_value = 0;

		// UI 요소 표시
		this.setProgressUIVisible(true)

		// 압축 해제 정보 가져오기
		let extract_total = _getenv( 'patch.extract_total' , 0 )
		let extract_complete = _getenv( 'patch.extract_complete' , 0 )
		
		// 다운로드 정보 가져오기 및 진행률 계산
		let download_total = _getenv( 'patch.download_total' , 0 )
		if( download_total > 0  )
		{
			let download_complete = _getenv( 'patch.download_complete' , 0 )
			
			// 진행률 계산 (백분율)
			patching_rate_value = Math.ceil( download_complete * 100 / download_total )
			
			// 진행 텍스트 생성 (완료/전체 KB 표시)
			patching_progress_text = Math.ceil( download_complete / 1024 ).toString() + PreTexts.getText('kb') + ' / ' + Math.ceil( download_total / 1024 ).toString() + PreTexts.getText('kb')
			
			// 진행바 UI 업데이트
			this.ctrls.progress_total.setVisible( true )
			this.ctrls.progress_total.setPercent( download_complete / download_total * 100 )
			this.ctrls.progress_bg.setVisible( true )
		}

		// TODO : 최초 패치에서만 발생 해야 함
		// patching_rate_value가 25, 50, 75, 100을 넘을 때마다 이벤트 발생 (중복 방지)
		[25, 50, 75, 100].forEach(function(rate) {
			if (patching_rate_value >= rate && !self._patchingRateEventFired[rate]) {
				self._patchingRateEventFired[rate] = true;
				
				// 광고 추적 이벤트 발송
				if(rate == 25) {
					_ad_custom_event('singular','czn_cdn_update_25_per', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '');
				} else if(rate == 50) {
					_ad_custom_event('singular','czn_cdn_update_50_per', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '');
				} else if(rate == 75) {
					_ad_custom_event('singular','czn_cdn_update_75_per', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '');
				} else if(rate == 100) {
					_ad_custom_event('singular','czn_cdn_update_100_per', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '');
				}
			}
		});

		// 점 깜빡임 애니메이션 (0.5초마다 변경)
		let dot_index = Math.floor( Date.now() / 500 ) % 3
		this.ctrls.deco_on_1.setVisible( dot_index == 0 )
		this.ctrls.deco_on_2.setVisible( dot_index == 1 )
		this.ctrls.deco_on_3.setVisible( dot_index == 2 )

		// 다운로드 완료 후 압축 해제 중일 때
		if (patching_rate_value >= 100 && (extract_complete < extract_total)) {
			patching_progress_text = Math.ceil( extract_complete / 1024 ).toString() + PreTexts.getText('kb') + ' / ' + Math.ceil( extract_total / 1024 ).toString() + PreTexts.getText('kb')
			this.ctrls.txt_update_status.setString(PreTexts.getText('content_extracting'))
		}
		else {
		
		// Dolphin (Xcent) 특수 처리: 상태 메시지 표시
			if( is_dolphin ) {
				this.ctrls.txt_update_status.setString(PreTexts.getText('content_downloading') + _getenv( 'xcent.dolphin.status', '' ) + _getenv( 'patch.error', '' ))
			} else {			
				this.ctrls.txt_update_status?.setString( PreTexts.getText('content_downloading') )
			}
		}
		
		// 진행률 메시지 표시
		this.setMessage( patching_rate_value.toString() + '%' , patching_progress_text )


		// 취소 또는 검증 중일 때는 메시지 숨김
		if (patch_status == 'cancel' || patch_status == 'verifying') {
			this.setMessage( '' , '' )
		}
	}

	/**
	 * 패치 검증(verifying) 상태 UI 업데이트
	 * - 패치 파일 다운로드 완료 후 검증 중일 때 호출됨
	 * - "Touch to Start" 버튼에 페이드 애니메이션 표시
	 */
	updatePatchVerifyingAction(patch_status)
	{
		// verifying 상태가 아니면 초기화
		if ("verifying" != patch_status) {
			if (this.verifying_action) {
				// 애니메이션 중지 및 UI 숨김
				this.ctrls.n_start.setVisible(false)
				this.ctrls.n_start.findChildByName('bg_start').stopAllActions();
				this.ctrls.n_start_text?.setString(PreTexts.getText('touch_to_start'))
				this.verifying_action = false;
			}
			return;
		}

		// verifying 상태: "Touch to Start" 버튼 표시 및 페이드 애니메이션 시작
		this.ctrls.n_start.setVisible(true)
		this.ctrls.n_start_text?.setString(PreTexts.getText('ui_patch_loading_title'))
		
		// 애니메이션이 아직 시작되지 않았으면 시작
		if (!this.verifying_action) {
			let action = cc.RepeatForever.create(
				cc.Sequence.create(
					cc.FadeTo.create(1.4, 255 * 0.5), // 반투명으로
					cc.FadeTo.create(1.4, 0)           // 투명으로
				)
			);
			this.ctrls.n_start.findChildByName('bg_start').runAction(action);
			this.verifying_action = true;
		}
	}

	/**
	 * 패치 체크(checking) 상태 UI 업데이트
	 * - 패치 정책 확인 중일 때 호출됨
	 * - 다운로드해야 할 파일 목록을 확인하는 단계
	 * - 폴리시별 다운로드 진행률 표시
	 */
	updatePatchCheckingAction(patch_status)
	{
		// checking 상태가 아니면 초기화 및 UI 숨김
		if ("checking" != patch_status) {
			// 이전에 표시했던 UI 요소들 숨김
			if (this.patch_checking_action) {
				this.setProgressUIVisible(false)
			}
			this.patch_checking_action = false;
			return;
		}

		// UI 요소 표시
		this.setProgressUIVisible(true)

		// 다운로드 상태 표시 텍스트 설정
		this.ctrls.txt_update_status?.setString(PreTexts.getText('patch_version_checking'))


		this.ctrls.progress_bg.setVisible(false)
		this.ctrls.progress_total.setVisible(false)
		// 진행률 메시지 표시
		this.setMessage('', '')

		// 점 깜빡임 애니메이션 (0.5초마다 변경)
		let dot_index = Math.floor(Date.now() / 500) % 3
		this.ctrls.deco_on_1.setVisible(dot_index == 0)
		this.ctrls.deco_on_2.setVisible(dot_index == 1)
		this.ctrls.deco_on_3.setVisible(dot_index == 2)

		// 액션 플래그 설정
		this.patch_checking_action = true;
	}

	patch_checking_action = false;
	verifying_action = false;

	update()
	{
		const self = this;
		const patch_status = _getenv( 'patch.status' )
		const is_dolphin = `${_getenv( 'xcent.dolphin', 0 )}` == "1"

		// UI 요소 초기화 (기본적으로 모두 숨김)
		this.ctrls.progress_total.setVisible( false )
		this.ctrls.progress_bg.setVisible( false )
		this.ctrls.pre_left.setVisible( false )
		this.ctrls.pre_right.setVisible( false )
		this.ctrls.n_login_right_btn.setVisible( false )
		this.setMessage( '' , '' )

		// FIXME : pre 쪽 패치 상태나 진행 처리 부분이 개선되어야 함.
		// FSM으로 바꾸거나 기타 상태 전환 코드가 명확하게 될 필요가 있음.
		// 지금은 너무 복잡하게 처리중이라, 원본 코드를 건드리지 않는 선에서 처리함.
		
		// checking 상태 진입 시 플래그 설정
		if (!self.patch_checking_action && "checking" == patch_status) {
			self.patch_checking_action = true;
		}

		// 패치 완료/취소/에러/검증 중 상태: 우측 버튼바 표시
		if( 'complete' == patch_status || 'cancel' == patch_status || 'error' == patch_status || "verifying" == patch_status )
		{
			this.ctrls.n_login_right_btn.setVisible( true )
		}
				
		//console.debug ( 'patch_status : ', patch_status , _getenv( 'patch.status' ) )	
		// 검증(verifying) 중 상태: Touch to Start 애니메이션 표시
		this.updatePatchVerifyingAction(patch_status)
		
		// 패치 체크(checking) 중 상태: 패치 정책 정보 수신 및 표시
		if(this.patch_checking_action) {
			this.updatePatchCheckingAction(patch_status)
		}
		// 패치 다운로드 중 상태: 진행률 및 다운로드 정보 표시
		else if(this._patchUIShow)
		{
			if( patch_status != 'ask_download' ) {
				this.updateProgressPatchData(patch_status)
			}
		}
	}

	createScene()
	{
		const self = this;
		const startTime = Date.now();
		console.log(`[PERFORMANCE] TitleScenePre.createScene() - START`);
		
		if( _get_cocos_refid( this.scene ) ) return this.scene

		let stepTime = Date.now();
		let winSize = cc.Director.getInstance().getWinSize()
		console.log(`[PERFORMANCE] TitleScenePre.createScene() - getWinSize took ${Date.now() - stepTime}ms`);

		stepTime = Date.now();
		let titleWin   = cc.CSLoader.createNode( 'ui/scene_title_pre.csb' )
		console.log(`[PERFORMANCE] TitleScenePre.createScene() - CSLoader.createNode took ${Date.now() - stepTime}ms`);

		stepTime = Date.now();
		this.ctrls = {}
        const spr_title = titleWin.findChildByName( 'spr_title' )
        spr_title.setVisible(false);

        const lang = Util.getUserLanguage();

        let eff_name = 'ui_bi_logo_en.cfx';
        if (lang == 'zht') {
            eff_name = 'ui_bi_logo_zht.cfx';
        } else if (lang == 'zhs') {
            eff_name = 'ui_bi_logo_zhs.cfx';
        } else if (lang == 'ko') {
            eff_name = 'ui_bi_logo_ko.cfx';
        } else if (lang == 'ja') {
            eff_name = 'ui_bi_logo_ja.cfx';
        } else {
            eff_name = 'ui_bi_logo_en.cfx';
        }

        let eff = bootres.get_effect(eff_name);
        if (eff) {
            this.ctrls.spr_title = eff;
            eff.setPosition(640, 360)
			eff.setVisible(false);
            titleWin.addChild(eff);

 			if (lang == 'zhs') {
				eff.setVisible(true);
				titleWin.findChildByName( 'n_health_use_game')?.setVisible(true);
			}
        }
		console.log(`[PERFORMANCE] TitleScenePre.createScene() - Logo effect setup took ${Date.now() - stepTime}ms`);
        
		stepTime = Date.now();
		this.ctrls.back = titleWin.findChildByName( '*back' )
		if (this.ctrls.back) {
			console.log('back found')
			this.ctrls.back.setVisible(false)
		}
		this.ctrls.text_app_info = titleWin.findChildByName( 'text_app_info' )
		this.ctrls.pre = titleWin.findChildByName( 'pre' )
		this.ctrls.pre?.setVisible( true );
		this.ctrls.pre_left = this.ctrls.pre.findChildByName( 'left' )
		this.ctrls.pre_right = this.ctrls.pre.findChildByName( 'right' )
		this.ctrls.pre_right?.setVisible( false )
		this.ctrls.pre_left?.setVisible( false )
		this.ctrls.n_start = titleWin.findChildByName( 'n_start' )
		this.ctrls.n_start?.setVisible( false )
		this.ctrls.n_start_text = this.ctrls.n_start.findChildByName( 'text_start' )
		this.ctrls.n_start_text?.setString( PreTexts.getText('touch_to_start') )
		this.ctrls.deco_status = titleWin.findChildByName( 'deco_status' )
		this.ctrls.deco_on_1 = this.ctrls.pre_left.findChildByName( 'deco_on_1' )
		this.ctrls.deco_on_2 = this.ctrls.pre_left.findChildByName( 'deco_on_2' )
		this.ctrls.deco_on_3 = this.ctrls.pre_left.findChildByName( 'deco_on_3' )
		this.ctrls.left_text_2 = titleWin.findChildByName( 'text_2' )
		this.ctrls.left_text_2.setVisible( false )
		this.ctrls.left_text_log = titleWin.findChildByName( 'text_log' )
		this.ctrls.left_text_log.setVisible( false )
		this.ctrls.txt_percent = titleWin.findChildByName( 'txt_percent' )
		this.ctrls.txt_percent?.setString( '' )
		this.ctrls.txt_message = titleWin.findChildByName( 'txt_message' )
		this.ctrls.txt_message?.setString( '' )
		this.ctrls.txt_update_status = titleWin.findChildByName( 'txt_update_status' )
		this.ctrls.txt_update_status?.setString( PreTexts.getText('content_downloading') )
		this.ctrls.progress_bg = titleWin.findChildByName( 'progress_bg' )
		this.ctrls.progress_total = titleWin.findChildByName( 'progress_total' )
		this.ctrls.progress_bg.setVisible( false )
		this.ctrls.progress_total.setVisible( false )
		this.ctrls.progress_total.setPercent( 0 )
		this.ctrls.txt_copyright = titleWin.findChildByName( 'txt_copyright' )
		this.ctrls.txt_copyright?.setString( PreTexts.getText('copyright') )
		this.ctrls.txt_app_status = titleWin.findChildByName( 'text_app_status' )
		this.ctrls.n_server = titleWin.findChildByName( 'n_server' )
		this.ctrls.n_server?.setVisible( false )
		this.ctrls.n_login_zhs = titleWin.findChildByName( 'n_login_zhs' )

		console.log(`[PERFORMANCE] TitleScenePre.createScene() - Basic UI controls setup took ${Date.now() - stepTime}ms`);

		this.ctrls.n_login_right_btn = titleWin.findChildByName( 'n_login_right_btn' )
		this.ctrls.n_btn_right = [];
		for (let i = 1; i < 5; i++) {
			this.ctrls.n_btn_right.push(this.ctrls.n_login_right_btn.findChildByName( 'n_btn_right_' + i ))
		}
		this.ctrls.n_qr_use = this.ctrls.n_login_right_btn.findChildByName( 'n_qr_use' )
		if (this.ctrls.n_qr_use) {
			console.log('n_qr_use found')

			this.ctrls.n_qr_use.ejectFromParent()
			this.ctrls.n_login_zhs?.addChild( this.ctrls.n_qr_use )
			this.ctrls.n_qr_use.setVisible(false)

			const qr_pos = this.ctrls.n_btn_right[0]?.getPosition() ?? {x: 0, y: 0}
			this.ctrls.n_qr_use.setPosition( qr_pos[0], qr_pos[1] )
		}
		this.ctrls.n_option = this.ctrls.n_login_right_btn.findChildByName( 'n_option' )
		if (this.ctrls.n_option) {
			console.log('n_option found')
			this.ctrls.n_option.setVisible(false)
		}
		this.ctrls.n_logout = this.ctrls.n_login_right_btn.findChildByName( 'n_logout' )
		if (this.ctrls.n_logout) {
			console.log('n_logout found')
			this.ctrls.n_logout.setVisible(false)
		}
		this.ctrls.n_server_change = this.ctrls.n_login_right_btn.findChildByName( 'n_server_change' )
		if (this.ctrls.n_server_change) {
			console.log('n_server_change found')
			this.ctrls.n_server_change.setVisible(false)
			this.ctrls.btn_server_change = this.ctrls.n_server_change.findChildByName( 'btn_server_change' )
		}
		this.ctrls.n_notice = this.ctrls.n_login_right_btn.findChildByName( 'n_notice' )
		if (this.ctrls.n_notice) {
			console.log('n_notice found')
			this.ctrls.n_notice.setVisible(false)
		}
		this.ctrls.n_close_game = this.ctrls.n_login_right_btn.findChildByName( 'n_close_game' )
		if (this.ctrls.n_close_game) {
			console.log('n_close_game found')
			this.ctrls.n_close_game.setVisible(false)
		}
		this.ctrls.n_bug_report = this.ctrls.n_login_right_btn.findChildByName( 'n_bug_report' )
		if (this.ctrls.n_bug_report) {
			console.log('n_bug_report found')
			this.ctrls.n_bug_report.setVisible(false)
		}

		this.ctrls.progress_total?.setVisible( false )

		stepTime = Date.now();
		// titleWin.findChildByName( 'left' )?.setVisible( false );
		titleWin.findChildByName( 'btn_start' )?.setVisible( false );
		this.ctrls.n_login_before = titleWin.findChildByName( 'n_login_before' )
		this.ctrls.n_login_before?.setVisible( false )
		this.ctrls.btn_login_apple = this.ctrls.n_login_before.findChildByName( 'btn_login_apple' )
		this.ctrls.btn_login_apple?.setVisible(false)
		this.ctrls.btn_login_apple?.findChildByName('text')?.setString(PreTexts.getText('apple_login_title'));

		this.ctrls.btn_login_qq = this.ctrls.n_login_before.findChildByName( 'btn_login_qq' )
		this.ctrls.btn_login_qq?.setVisible(false)
		this.ctrls.btn_login_wechat = this.ctrls.n_login_before.findChildByName( 'btn_login_wechat' )
		this.ctrls.btn_login_wechat?.setVisible(false)
		this.ctrls.btn_login_stove = this.ctrls.n_login_before.findChildByName( 'btn_login' )
		this.ctrls.btn_login_stove?.setVisible(false)

		this.ctrls.n_btn_pos_0 = this.ctrls.n_login_before.findChildByName( 'n_btn_pos_0' )
		this.ctrls.n_btn_pos_1 = this.ctrls.n_login_before.findChildByName( 'n_btn_pos_1' )
		this.ctrls.n_btn_pos_2 = this.ctrls.n_login_before.findChildByName( 'n_btn_pos_2' )

		let text_login_stove = this.ctrls.btn_login_stove?.findChildByName('text')
		text_login_stove?.setString(PreTexts.getText('ui_game_login'))

		this.ctrls.n_qr_panel = this.ctrls.n_qr_use?.findChildByName('n_qr_pannel')
		this.ctrls.n_qr_panel?.setVisible( false )
		this.ctrls.btn_qr_use = this.ctrls.n_qr_use.findChildByName('btn_qr_use')
		this.ctrls.btn_qr_close = this.ctrls.n_qr_use.findChildByName('btn_qr_close')
		this.ctrls.btn_qr_qq = this.ctrls.n_qr_use.findChildByName("n_qr_qq").findChildByName("btn_qr_use");
		this.ctrls.btn_qr_wechat = this.ctrls.n_qr_use.findChildByName("n_qr_wechat").findChildByName("btn_qr_use");
		titleWin.findChildByName( 'right' )?.setVisible( false );
		titleWin.findChildByName( 'n_panho_notice' )?.setVisible( false );
		console.log(`[PERFORMANCE] TitleScenePre.createScene() - Login UI setup took ${Date.now() - stepTime}ms`);

		stepTime = Date.now();
		this.ctrls.text_app_info.setString(Util.getBuildPatchInfo())

		this.setMessage( '' , '' )

		titleWin.setAnchorPoint( 0.5, 0.5 )

		console.log('winSize: ', winSize.width, winSize.height)
		console.log(`[PERFORMANCE] TitleScenePre.createScene() - Initial setup took ${Date.now() - stepTime}ms`);

		stepTime = Date.now();
		let scene = cc.Layer.create()
		scene.setContentSize(winSize)

		// letterBox
		let _letterBox = [
            cc.LayerColor.create( {a : 255 , r : 0 , g : 0 , b : 0 }),
            cc.LayerColor.create( {a : 255 , r : 0 , g : 0 , b : 0 }),
        ]
		const SCENE_DESIGN_HEIGHT = 720
		const SCENE_DESIGN_WIDTH = 1280
        let _letterHeight =  ( winSize.height - SCENE_DESIGN_HEIGHT ) / 2

		_letterBox[0].setContentSize({width: winSize.width ,height: _letterHeight })
        _letterBox[1].setContentSize({width: winSize.width ,height: _letterHeight })

        _letterBox[0].setPosition(0, winSize.height - _letterHeight)
        _letterBox[1].setPosition(0,0)

		scene.addChild( _letterBox[0] )
        scene.addChild( _letterBox[1] )
        _letterBox[0].setLocalZOrder(1000000)
        _letterBox[1].setLocalZOrder(1000000)

		titleWin.setPosition( winSize.width / 2, winSize.height /2 )
		scene.setAnchorPoint(0.5, 0.5)
		scene.addChild( titleWin )
		this.scene = scene
		console.log(`[PERFORMANCE] TitleScenePre.createScene() - Scene creation took ${Date.now() - stepTime}ms`);

		stepTime = Date.now();
		const pre_btn = ccui.Widget.create();
        pre_btn.setName("pre_maintenance_btn");
        pre_btn.setAnchorPoint(0.5, 0.5);
        pre_btn.setContentSize(winSize);
        pre_btn.setPosition( winSize.width / 2 , winSize.height /2 );
		pre_btn.setLocalZOrder(1000000);
        pre_btn.setTouchEnabled(true);
        this.scene.addChildFirst(pre_btn);

		bootres.addTouchEndEventListener(pre_btn, function(_node, sender, state, x, y) {
			if (self.pre_button_callback) {
				self.pre_button_callback()
			}
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_server_change, function(_node, sender, state, x, y) {
			self.showWorldSelector(function(world) {
				if (world !== undefined) {
					if (world === self._selectedWorld) {
						console.log('world is same as selectedWorld')
						return
					}
					self._selectedWorld = world
					Util.setSelectedWorld(world)
					self.is_world_user_selected = true
					self.queryEntry(function(is_success, version_json, target_version_json) {
						if (is_success) {
							self.handleEntryResult(version_json, target_version_json)
						} else {
							console.error('queryEntry failed')
						}
					})
				}
			})
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_login_stove, function(_node, sender, state, x, y) {
			self.ctrls.btn_login_stove.setTouchEnabled(false);
            _ad_custom_event('singular', 'czn_login_view_click', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
			TitleScenePre.publisher.login()
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_login_apple, function(_node, sender, state, x, y) {
			const platform = _getenv('platform');
			if (platform == 'iphoneos') {			
			self.ctrls.btn_login_apple.setTouchEnabled(false);
			TitleScenePre.publisher.login("loginApple")
			} else {
				console.log('if not iphoneos, do nothing on apple login button');
			}				
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_login_qq, function(_node, sender, state, x, y) {
			self.ctrls.btn_login_qq.setTouchEnabled(false);
			TitleScenePre.publisher.login("loginQQ")
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_login_wechat, function(_node, sender, state, x, y) {
			if( TitleScenePre.publisher.isAppInstalled("wechat") ) {
				self.ctrls.btn_login_wechat.setTouchEnabled(false);
				TitleScenePre.publisher.login("loginWechat")
			} else {
				console.log('wechat app is not installed');
			}
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_qr_qq, function(_node, sender, state, x, y) {
			self.ctrls.btn_qr_qq.setTouchEnabled(false);
			TitleScenePre.publisher.login("loginQQbyQR")
			self.ctrls.n_qr_panel?.setVisible(false);
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_qr_wechat, function(_node, sender, state, x, y) {
			self.ctrls.btn_qr_wechat.setTouchEnabled(false);
			TitleScenePre.publisher.login("loginWechatbyQR")
			self.ctrls.n_qr_panel?.setVisible(false);
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_qr_use, function(_node, sender, state, x, y) {
			self.ctrls.n_qr_panel?.setVisible(true);
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_qr_close, function(_node, sender, state, x, y) {
			self.ctrls.n_qr_panel?.setVisible(false);
		})

		const n_age_kr = titleWin.getChildByName('n_age_kr')
		const btn_age_zhs = titleWin.getChildByName('btn_age_zhs')
		const btn_age_tw = titleWin.getChildByName('btn_age_tw')
		this.ctrls.n_age_kr = n_age_kr
		this.ctrls.btn_age_zhs = btn_age_zhs
		this.ctrls.btn_age_tw = btn_age_tw

		n_age_kr.setVisible(false);
		btn_age_zhs.setVisible(false);
		btn_age_tw.setVisible(false);
		
		console.log(`[PERFORMANCE] TitleScenePre.createScene() - Event listeners setup took ${Date.now() - stepTime}ms`);
		console.log(`[PERFORMANCE] TitleScenePre.createScene() - TOTAL took ${Date.now() - startTime}ms`);

		function search_for_nodes(node, left_nodes, right_nodes) {
			if (node.getName().toUpperCase() == 'LEFT') {
				left_nodes.push(node);
			} else if (node.getName().toUpperCase() == 'RIGHT') {
				right_nodes.push(node);
			}
			if (node.getChildrenCount() > 0) {
				for (let i = 0; i < node.getChildrenCount(); i++) {
					search_for_nodes(node.getChildren().at(i), left_nodes, right_nodes);
				}
			}
		}
		let left_nodes = [];
		let right_nodes = [];
		search_for_nodes(this.scene, left_nodes, right_nodes);
		console.log('left_nodes : ', left_nodes.map(node => node.getName()));
		console.log('right_nodes : ', right_nodes.map(node => node.getName()));

		let safeAreaRect = cc.Director.getInstance().getSafeAreaRect()
		const left_adjust = (safeAreaRect.width - SCENE_DESIGN_WIDTH) / 2 - safeAreaRect.x;
		console.log('left_adjust : ', left_adjust);
		const right_adjust = (safeAreaRect.width - SCENE_DESIGN_WIDTH) / 2 - safeAreaRect.x;
		console.log('right_adjust : ', right_adjust);
		for (let i = 0; i < left_nodes.length; i++) {
			left_nodes[i].setPosition(left_nodes[i].getPosition()[0] - left_adjust, left_nodes[i].getPosition()[1]);
			console.log('left_nodes[i] : ', left_nodes[i].getName(), left_nodes[i].getPosition());
		}
		for (let i = 0; i < right_nodes.length; i++) {
			right_nodes[i].setPosition(right_nodes[i].getPosition()[0] + right_adjust, right_nodes[i].getPosition()[1]);
			console.log('right_nodes[i] : ', right_nodes[i].getName(), right_nodes[i].getPosition());
		}

		const original_progress_bg_size = this.ctrls.progress_bg.getContentSize();
		this.ctrls.progress_bg.setContentSize({width: original_progress_bg_size.width + left_adjust + right_adjust, height: original_progress_bg_size.height});
		const original_progress_total_size = this.ctrls.progress_total.getContentSize();
		this.ctrls.progress_total.setContentSize({width: original_progress_total_size.width + left_adjust + right_adjust, height: original_progress_total_size.height});

		titleWin.findChildByName("n_qr_use")?.setVisible(false);
		titleWin.findChildByName("n_option")?.setVisible(false);
		titleWin.findChildByName("n_logout")?.setVisible(false);
		titleWin.findChildByName("n_server_change")?.setVisible(false);
		titleWin.findChildByName("n_notice")?.setVisible(false);
		titleWin.findChildByName("n_close_game")?.setVisible(false);
		titleWin.findChildByName("n_bug_report")?.setVisible(false);

		ResolutionHandler.getInstance().addDelegate({
			ref: scene,
			func: (newWidth, newHeight) => {
				titleWin.setPosition( newWidth/2, newHeight/2 );
				_letterBox[0].setContentSize({width: ResolutionHandler._winSize.width ,height: ResolutionHandler._letterHeight });
				_letterBox[1].setContentSize({width: ResolutionHandler._winSize.width ,height: ResolutionHandler._letterHeight });
				_letterBox[0].setPosition(0, ResolutionHandler._winSize.height - ResolutionHandler._letterHeight);
				_letterBox[1].setPosition(0, 0);
			}
		});

		return this.scene
	}

	getTargetLayer() {
		return this.scene || global.pre.pre_layer
	}

	setPreButtonCallback(callback) {
		this.pre_button_callback = callback
	}

	setMessage( status , message )
	{
		if( _get_cocos_refid( this.ctrls.txt_percent ) )
		{
			this.ctrls.txt_percent.setString( status )
		}
		if( _get_cocos_refid( this.ctrls.txt_message ) )
		{
			this.ctrls.txt_message.setString( message )
		}
	}

	refreshMaintenance(version_json, target_version_json) {
		console.log('refreshMaintenance')
		const self = this;

		const terminate_maintenance = function() {
			const target_layer = self.getTargetLayer()
			if (target_layer && _get_cocos_refid(target_layer)) {
				target_layer.getChildByName('maintenance')?.findChildByName( 'n_popup' )?.removeFromParent();
			}
			self.showNoticePopup(PreTexts.getText('maintenance_finished'), undefined)
			const t_time_count = target_layer.findChildByName('t_time_count')
			if (t_time_count && _get_cocos_refid(t_time_count) && self.time_count_action) {
				t_time_count.stopAction(self.time_count_action)
			}
			self.time_count_action = undefined
		}

		let maintenance_info = EntryUtil.isMaintenance(version_json)
		if (!maintenance_info) {
			console.log('maintenance end')
			terminate_maintenance()
			return
		}
	
		const title = maintenance_info['title']
		const msg = maintenance_info['msg']
		const url_patch_note = maintenance_info['url_patch_note']
		const url_notice = maintenance_info['url_notice']
		const url_sns = maintenance_info['url_sns']
		const start_time = Number(maintenance_info['start_time'])
		const end_time = Number(maintenance_info['end_time'])
		const status = Number(maintenance_info['status'])
	
		const start_time_text = Util.getTimeString(start_time)
		const end_time_text = Util.getTimeString(end_time)
	
		const target_layer = this.scene;
	
		let maintenance_layer = target_layer.getChildByName('maintenance')
		if (!maintenance_layer) {
			console.log('create maintenance layer')
			let winSize = cc.Director.getInstance().getWinSize()
			let maintenance_node = cc.CSLoader.createNode( 'ui/title_server_down.csb' )
			maintenance_node.setName('maintenance')
			maintenance_node.setAnchorPoint(0.5, 0.5)
			maintenance_node.setPosition(winSize.width / 2, winSize.height / 2)
			let maintenance_temp_img = maintenance_node.getChildByName('Image')
			if (maintenance_temp_img) {
				maintenance_temp_img.removeFromParent()
			}
			let maintenance_dim_layer = maintenance_node.getChildByName('dim')
			// if (maintenance_dim_layer) {
			// 	maintenance_dim_layer.setOpacity(192)
			// }
	
			console.log('add maintenance layer name :', maintenance_node.getName())
			target_layer.addChild(maintenance_node)
			maintenance_layer = maintenance_node
		}
		this.setMessage('', '')
	
		let winSize = cc.Director.getInstance().getWinSize()
	
		const image = maintenance_layer.getChildByName('Image')
		if (image) {
			let bgSize = image.getContentSize()
			if (bgSize.width > 0 && bgSize.height > 0) {
				console.log('bgSize: w:', bgSize.width, ' h:', bgSize.height)
				let scale = Math.max( winSize.width / bgSize.width, winSize.height / bgSize.height )
				image.setScale( scale )
				console.log('scale: ', scale)
			}
			image.setAnchorPoint( 0.5, 0.5 )
			image.setPosition( winSize.width/2 - image.getWorldPosition()[0], winSize.height/2)
		}
	
		const n_popup = maintenance_layer.findChildByName( 'n_popup' )
		const n_popup_content = n_popup.findChildByName( 'n_content' )
		const n_popup_title = n_popup.findChildByName( 'n_title' )
		n_popup_title.findChildByName( 't_title' ).setString(title)
		n_popup_title.findChildByName( 't_title' ).ignoreContentAdaptWithSize(true)
		const t_title_sub = n_popup_content.findChildByName( 't_title_sub' )
		t_title_sub.setString(PreTexts.getText('maintenance_time_remain'))
		const t_title_start_time = n_popup_content.findChildByName( 't_title_start_time' )
		t_title_start_time.setString(PreTexts.getText('maintenance_time_start'))
		const t_title_start_time_value = n_popup_content.findChildByName( 't_time_start_value' )
		const t_title_end_time = n_popup_content.findChildByName( 't_title_end_time' )
		t_title_end_time.setString(PreTexts.getText('maintenance_time_end'))
		const t_title_end_time_value = n_popup_content.findChildByName( 't_time_end_value' )
		const n_popup_confirm = n_popup.findChildByName( 'n_confirm' )
		const btn_stove = n_popup_confirm.findChildByName( 'btn_stove' )
		const btn_stove_text = btn_stove.findChildByName( 'text_stove' )
		btn_stove_text.setString(PreTexts.getText('maintenance_patch_notice'))
		const btn_note = n_popup_confirm.findChildByName( 'btn_note' )
		const btn_note_text = btn_note.findChildByName( 'text_note' )
		btn_note_text.setString(PreTexts.getText('maintenance_patch_note'))
		const btn_sns_x = n_popup_confirm.findChildByName( 'btn_sns_x' )
		const btn_sns_x_text = btn_sns_x.findChildByName( 'text_sns_x' )
		btn_sns_x_text.setString(PreTexts.getText('maintenance_patch_sns'))
		const n_status = n_popup_content.findChildByName( 'n_status' )
		const bg_status = n_status.findChildByName( 'bg_status' )
		const text_status = n_status.findChildByName( 't_status' )
		text_status.ignoreContentAdaptWithSize(true)
		n_status.setVisible(false)

		if (status == 0) { // 연장점검
			bg_status.setColor(new cc.Color(239, 120, 41))
			text_status.setString(PreTexts.getText('maintenance_status_longer'))
			n_status.setVisible(true)
		} else if (status == 1) { // 조기종료
			bg_status.setColor(new cc.Color(114, 190, 110))
			text_status.setString(PreTexts.getText('maintenance_status_shorter'))
			n_status.setVisible(true)
		} else { // 점검
			bg_status.setColor(new cc.Color(111, 111, 111))
			text_status.setString(PreTexts.getText('maintenance_status_shorter'))
			n_status.setVisible(false)
		}
		const text_status_width = text_status.getContentSize().width * text_status.getScaleX()
		bg_status.setContentSize({width: text_status_width + 42, height: 24})
	
		let current_time = Date.now()
		console.log('current_time : ', current_time)
		let entry_timestamp = version_json['_entry_timestamp']
		this.time_diff_with_entry_time = 0
		if (entry_timestamp) {
			let entry_time = entry_timestamp * 1000
			console.log('entry_time : ', entry_time)
			this.time_diff_with_entry_time = current_time - entry_time
			console.log('time_diff_with_entry_time : ', this.time_diff_with_entry_time)
			current_time = entry_time
		}
		this.time_count_remaining_seconds = Math.floor(((end_time * 1000) - current_time)/1000);
		console.debug( this.time_count_remaining_seconds )
	
		const local_start_time_text = Util.getLocalTimeString(start_time, true)
		const local_end_time_text = Util.getLocalTimeString(end_time, true)
		console.debug( local_start_time_text , local_end_time_text )
		t_title_start_time_value.setString(local_start_time_text)
		t_title_start_time_value.ignoreContentAdaptWithSize(true);
		t_title_end_time_value.setString(local_end_time_text)
		t_title_end_time_value.ignoreContentAdaptWithSize(true);
		const t_title_end_time_width = t_title_end_time_value.getContentSize().width
		n_status.setPosition(t_title_end_time_width - 76, -102)
		console.log('n_status position: ', n_status.getPosition()[0], n_status.getPosition()[1])
	
		let txt_version_detail = maintenance_layer.findChildByName( 'txt_version_detail' )
		if( txt_version_detail ) {
			txt_version_detail.removeFromParent();
		}
	
		let t_notice = n_popup_content.findChildByName( 't_notice' )
		t_notice.setString(PreTexts.getText('maintenance_description'))
	
		let btn_close = maintenance_layer.findChildByName( 'btn_close' )
		if (btn_close) {			
			bootres.addTouchEndEventListener(btn_close, function(_node, sender, state, x, y) {
				maintenance_layer.setVisible(false);
				self.setPreButtonCallback(function() {
					maintenance_layer.setVisible(true);
					self.setPreButtonCallback(undefined)
				})
			})
		}

		let visible_buttons = [];

		bootres.addTouchEndEventListener(btn_note, function(_node, sender, state, x, y) {
			const sound_event = ccexp.SoundEngine.getInstance().createEvent("event:/ui/ok");
			if (sound_event) {
				sound_event.start();
			}
			if (url_patch_note) {
				cc.Director.getInstance().openURL(url_patch_note)
			} else {
				console.log('url_patch_note is empty')
			}
		})
		if (url_patch_note && url_patch_note.length > 5) {
			btn_note.setVisible(true);
			visible_buttons.push(btn_note);
		} else {
			btn_note.setVisible(false);
		}

		bootres.addTouchEndEventListener(btn_stove, function(_node, sender, state, x, y) {
			const sound_event = ccexp.SoundEngine.getInstance().createEvent("event:/ui/ok");
			if (sound_event) {
				sound_event.start();
			}
			if (url_notice) {
				cc.Director.getInstance().openURL(url_notice)
			} else {
				console.log('url_notice is empty')
			}
		})
		if (url_notice && url_notice.length > 5) {
			btn_stove.setVisible(true);
			visible_buttons.push(btn_stove);
		} else {
			btn_stove.setVisible(false);
		}

		bootres.addTouchEndEventListener(btn_sns_x, function(_node, sender, state, x, y) {
			const sound_event = ccexp.SoundEngine.getInstance().createEvent("event:/ui/ok");
			if (sound_event) {
				sound_event.start();
			}
			if (url_sns) {
				cc.Director.getInstance().openURL(url_sns)
			} else {
				console.log('url_sns is empty')
			}
		})
		if (url_sns && url_sns.length > 5) {
			btn_sns_x.setVisible(true);
			visible_buttons.push(btn_sns_x);
		} else {
			btn_sns_x.setVisible(false);
		}

		if (visible_buttons.length == 1) {
			visible_buttons[0].setAnchorPoint(0.5, 0.5)
			visible_buttons[0].setPosition(0, 0)
		} else if (visible_buttons.length == 2) {
			visible_buttons[0].setAnchorPoint(0.5, 0.5)
			visible_buttons[0].setPosition(-148, 0)
			visible_buttons[1].setAnchorPoint(0.5, 0.5)
			visible_buttons[1].setPosition(148, 0)
		} else if (visible_buttons.length == 3) {
			visible_buttons[0].setAnchorPoint(0.5, 0.5)
			visible_buttons[0].setPosition(-295, 0)
			visible_buttons[1].setAnchorPoint(0.5, 0.5)
			visible_buttons[1].setPosition(0, 0)
			visible_buttons[2].setAnchorPoint(0.5, 0.5)
			visible_buttons[2].setPosition(295, 0)
		}
	
		let t_time_count = n_popup_content.findChildByName( 't_time_count' )
		t_time_count.ignoreContentAdaptWithSize(true)
		t_time_count.stopAllActions();

		this.time_count_action = cc.RepeatForever.create(cc.Sequence.create(
			cc.CallFunc.create(function() {
				if (!t_time_count || !_get_cocos_refid(t_time_count)) return
				self.time_count_remaining_seconds = Math.floor(((end_time * 1000) - (Date.now() - self.time_diff_with_entry_time))/1000);
				if (self.time_count_remaining_seconds < 0 || !Number.isInteger(self.time_count_remaining_seconds)) {
					self.time_count_remaining_seconds = 0
				}
				let hour = Math.floor(self.time_count_remaining_seconds / 3600)
				if (hour < 10) hour = '0' + hour
				let minute = Math.floor((self.time_count_remaining_seconds % 3600) / 60)
				if (minute < 10) minute = '0' + minute
				let second = self.time_count_remaining_seconds % 60
				if (second < 10) second = '0' + second
				t_time_count.setString(`${hour} : ${minute} : ${second}`)	
			}),
			cc.DelayTime.create(0.1),
		))
		t_time_count.runAction(this.time_count_action)

		this.time_query_action = cc.RepeatForever.create(cc.Sequence.create(
			cc.DelayTime.create(1),
			cc.CallFunc.create(function() {
				if (!t_time_count || !_get_cocos_refid(t_time_count)) return
				self.time_count_remaining_seconds = Math.floor(((end_time * 1000) - (Date.now() - self.time_diff_with_entry_time))/1000);
				if (self.time_count_remaining_seconds < 0 || !Number.isInteger(self.time_count_remaining_seconds)) {
					console.log("maintenance finished")
					terminate_maintenance()
					return
				}
				if (self.time_count_remaining_seconds == global.pre.last_query_remaining_seconds) {
					return
				}
				if (self.time_count_remaining_seconds % 300 == 0) {
					console.log("maintenance time_query again")
					global.pre.last_query_remaining_seconds = self.time_count_remaining_seconds
					// 5분마다 다시 점검 데이터 쿼리 후 로드
					t_time_count.stopAction(self.time_query_action)
					self.time_query_action = undefined
					self.queryEntry(function(is_success, version_json, target_version_json) {
						if (is_success) {
							self.refreshMaintenance(version_json, target_version_json)
						} else {
							console.error('queryEntry failed')
						}
					})
				}
			}),
		))
		t_time_count.runAction(this.time_query_action)

		
	}
	
	showNoticePopup(text, custom_callback) {
		console.log('show_notice_popup : ', text)
		if (!this.block_popup) {
			// createScene 이전에 호출, pre layer 에 붙임
			var layer = this.getTargetLayer()
			const block_popup = new TitleBlockPopup(layer)
			block_popup.show(text, custom_callback)	
		} else {
			// createScene 에서 title scene 에 붙어져 만들어진 block_popup 사용
			this.block_popup.show(text, custom_callback)
		}
	}

	showConfirmPopup(title, text, custom_callback) {
		console.log('show_confirm_popup : ', title, text)
		if (!this.confirm_popup) {
			// createScene 이전에 호출, pre layer 에 붙임
			var layer = this.getTargetLayer()
			const confirm_popup = new TitleConfirmPopup(layer)
			confirm_popup.show(title, text, custom_callback)
		} else {
			// createScene 에서 title scene 에 붙어져 만들어진 confirm_popup 사용
			this.confirm_popup.show(title, text, custom_callback)
		}
	}

	showConfirmDownloadPopup(download_kb, callback, is_pre_download) {
		console.log('show_confirm_download_popup : ', download_kb)
		if (!this.confirm_download_popup) {
			// createScene 이전에 호출, pre layer 에 붙임
			var layer = this.getTargetLayer()
			const confirm_popup = new TitleConfirmDownloadPopup(layer)
			confirm_popup.show(download_kb, callback, is_pre_download)
		} else {
			// createScene 에서 title scene 에 붙어져 만들어진 confirm_download_popup 사용
			this.confirm_download_popup.show(download_kb, callback, is_pre_download)
		}
	}

	showWorldSelector(callback)
	{
		console.log('showWorldSelector')
		if (!_get_cocos_refid(this.scene)) {
			return
		}
		const patch_status = _getenv('patch.status')
		if (patch_status !== "" && patch_status !== "checking" && patch_status !== 'complete' && patch_status !== 'cancel' && patch_status !== 'error') {
			return
		}
		if (!this.world_selector) {
			this.world_selector = new TitleOptionSelectPopup(this, 'ui/overlay_popup_server_select.csb', 'WORLD', this.getTargetLayer())
		}
		const worlds = Util.getAllowedWorlds()
		this.world_selector.show(worlds, callback)
	}

	showVoiceSelector(callback)
	{
		console.log('showVoiceSelector')
		if (!_get_cocos_refid(this.scene)) {
			return
		}
		const patch_status = _getenv('patch.status')
		if (patch_status !== "" && patch_status !== "checking"&& patch_status !== 'complete' && patch_status !== 'cancel' && patch_status !== 'error') {
			return
		}
		if (!this.voice_selector) {
			this.voice_selector = new TitleOptionSelectPopup(this, 'ui/overlay_popup_sound_select.csb', 'VOICE', this.getTargetLayer())
		}
		const voices = Util.getAllowedVoices()
		this.voice_selector.show(voices, callback)
	}

	showLanguageSelector(callback)
	{
		console.log('showLanguageSelector')
		if (!_get_cocos_refid(this.scene)) {
			return
		}
		const patch_status = _getenv('patch.status')
		if (patch_status !== "" && patch_status !== 'complete' && patch_status !== 'cancel' && patch_status !== 'error') {
			return
		}
		if (!this.language_selector) {
			this.language_selector = new TitleOptionSelectPopup(this, 'ui/overlay_popup_sound_select.csb', 'LANGUAGE', this.getTargetLayer())
		}
		const languages = Util.getAllowedLanguages()
		this.language_selector.show(languages, callback)
	}

	getBuildPatchInfo() {
		return Util.getBuildPatchInfo()
	}

	updateBuildPatchInfo() {
		this.ctrls.text_app_info.setString(Util.getBuildPatchInfo())
	}

	getPublisherInitializeResult()
	{
		console.log('getPublisherInitializeResult')
		if (TitleScenePre.publisher) {
			console.log('returning initialize_result : ', TitleScenePre.publisher.initialize_result)
			return TitleScenePre.publisher.initialize_result;
		}
		return undefined;
	}

	getPublisherLoginResult()
	{
		console.log('getPublisherLoginResult')
		if (TitleScenePre.publisher) {
			console.log('returning login_result : ', TitleScenePre.publisher.login_result)
			return TitleScenePre.publisher.login_result;
		}
		return undefined;
	}

	// callback(boolean is_success, version_json)
    queryEntry(callback) {
		console.log('queryEntry')
		const self = this;
        console.log( '_async_load_version_info' )
        if( !_getenv('verinfo.api') || _getenv('verinfo.api') == '' )
        {
			_perf_gem_post_step_event('login', 1, 1, 0, 'invalid verinfo api', '', false, false)			
            _setenv('verinfo.error', 'invalid verinfo api.\n verinfo api: ' + _getenv('verinfo.api', 'nil' ) )

            let jobject = JSON.parse( _getenv('verinfo.error') )
            console.log( 'verinfo.error', jobject )
            callback(false);
            return;
        }
        else
        {
            console.log( '[pre step] 2. async_load_remote_environment' )
			_perf_gem_post_step_event('login', 1, 0, 0, 'success', '', false, false)
            _setenv( 'verinfo.error', '' )
            _setenv( 'patch.error', '' )


            // 결과 처리 공통 함수
            const on_completed = function(entry_result) {
                console.log( 'completed!!  async_load_remote_environment' )
                console.log( 'entry result : ', entry_result)
                
                global.pre.version_json = _get_version_json()
                let is_valid_verinfo = EntryUtil.isValidVersionInfo(global.pre.version_json);
                if (!is_valid_verinfo) {
                    console.error('verinfo.data is not valid json : ', JSON.stringify(global.pre.version_json) )
                    self.showNoticePopup(PreTexts.getText('connect_error'), undefined)
                    callback(false);
                    return;
                }
                global.pre.target_version_json = EntryUtil.getTargetVersionInfo(global.pre.version_json)
                const stringified_target_version_json = JSON.stringify(global.pre.target_version_json)
                console.log('target_version_json : ', stringified_target_version_json)

            
                _load_json_environment(stringified_target_version_json)
                //최종 적으로 World 를 업데이트한다. 
                Util.updateFinalEnvironment()					

                callback(true, global.pre.version_json, global.pre.target_version_json)
            };

            // ⭐ [EARLY FETCH] 미리 시작된 네이티브 통신이 있으면 그 결과를 사용
            if (global.pre.early_fetch_promise) {
                console.log('🚀 [EARLY FETCH] Using pre-started native fetch promise in queryEntry...')
                global.pre.early_fetch_promise.then(function(result) {
                    global.pre.early_fetch_promise = null; // 재사용 방지
                    on_completed(result);
                });
            } else {
                console.log('🚀 [EARLY FETCH] No early fetch found, starting native call now...')
                _async_load_remote_environment(on_completed);
            }
        }
    }

	async start() {
		const self = this;
		
		if (!self.scene) {
			console.log('create title scene in start')
			await self.timeSleep(1);
			let cocosScene = cc.Scene.create()
			cc.Director.getInstance().replaceScene( cc.TransitionFade.create( 0.5 , cocosScene , new cc.Color(0, 0, 0) ) )
			const movie_cdn = _getenv("title_movie_cdn_first", "")
			const last_known_title_movie_cdn = cc.UserDefault.getInstance().getStringForKey("last_known_title_movie_cdn")
			if (last_known_title_movie_cdn) {
				console.log('use last_known_title_movie_cdn :', last_known_title_movie_cdn)
				_setenv("title_movie_cdn", last_known_title_movie_cdn)
			} else {
				_setenv("title_movie_cdn", movie_cdn)
			}
			_setenv("title_movie_cdn_first", movie_cdn)
			

			let scene = self.createScene()
			self.show(cocosScene)
			self.startVideo()
	
			let after_draw_event =  cc.EventListenerCustom.create( 'director_after_draw' , global._director_after_draw )
			cc.Director.getInstance().getEventDispatcher().addEventListenerWithSceneGraphPriority( after_draw_event , scene )
		}
		self.updatePhase('pre init')
		// 퍼블리셔 초기화 먼저 시작.
		const pubInitPromise = self.procPublisherInit();

		// 왜 기다리는지 모르겠긴 함... 왜지?? 일단 줄여보자.
		// if (this.is_first_patch) {
		// 	await self.timeSleep(2600);
		// } else {
		// 	await self.timeSleep(750);
		// }
		//await self.timeSleep(500);

		// 일단 알림권한 셀프제어 없애기로 했습니다.
		// this.checkPermission();
		// this.onPermissionChecked()

		if (TitleScenePre.publisher) {
			// 퍼블리셔 초기화 대기후 로그인 처리.
			await pubInitPromise;
			await self.procPublisherLogin(); // <-- 여기서 쿼리엔트리까지 다 처리함
		} else {
			// publisher 없다면 그냥 바로 엔트리 쿼리후 진행.
			self.procQueryEntry();
		}
	}

	async checkPermission() {
	 	const self = this;
	 	const platform = _getenv('platform');
	 	if (platform == 'android') {
	 		self.updatePhase('pre permission')
 		let permission_popup = null;

	 		// show popup first if os lang is ko
	 		if (Util.getOsLanguage() == 'ko') {
	 			if (!Util.isPermissionChecked()) {
	 				await new Promise(function(resolve) {
	 					permission_popup = self.showPermissionPopup(function() {
	 						resolve(true)
	 					})
	 				})
	 			}
	 		}

	 		cc.Device.addPermissionResultCallback(function(permission_granted) {
	 			console.log('permission_granted : ', permission_granted)
	 			Util.setPermissionChecked(true)
	 			self.onPermissionChecked()
	 			if (permission_popup) {
	 				permission_popup.hide()
	 			}
	 		})
		 		cc.Device.requestPushPermission();
	 	} else {
	 		self.onPermissionChecked()
	 	}
	 }

	 showPermissionPopup(callback) {
	 	const self = this;
	 	if (!self.permission_popup) {
	 		self.permission_popup = new TitlePermissionPopup(self, 'ui/overlay_popup_authority.csb', self.getTargetLayer())
	 	}
	 	self.permission_popup.show(callback)

	 	return self.permission_popup;
	 }

	 async onPermissionChecked() {
	 	const self = this;
	 	if (TitleScenePre.publisher) {
	 		self.handlePublisher()
	 	} else {
	 		// publisher 없다면 그냥 바로 엔트리 쿼리
	 		self.updatePhase('pre init.')
	 		console.log('queryEntry start')
	 		self.queryEntry(function(is_success, version_json, target_version_json) {
	 			console.log('queryEntry result : ', is_success)
	 			if (is_success) {
	 				self.handleEntryResult(version_json, target_version_json)
	 			} else {
	 				console.error('queryEntry failed')
	 			}
	 		})
	 	}
	 }

	async procQueryEntry() {
		const self = this;
		self.updatePhase('pre init.')
		console.log('queryEntry start')
		self.queryEntry(function(is_success, version_json, target_version_json) {
			console.log('queryEntry result : ', is_success)
			if (is_success) {
				self.handleEntryResult(version_json, target_version_json)
			} else {
				console.error('queryEntry failed')
			}
		})
	}

	async procPublisherInit() {
		if (!TitleScenePre.publisher) return Promise.resolve();
		const self = this;
		self.updatePhase('pre pub.')
		// { result: true, error: error } 형태로 리턴
		const initialize_result = await TitleScenePre.publisher.initialize()
		self.updatePhase('pre pub..')
		console.log('initialize_result : ', JSON.stringify(initialize_result))
		if (!initialize_result.result) {
			console.error('initialize failed : ', initialize_result.error)
			self.updatePhase('pre pub...')
			self.showNoticePopup(PreTexts.getText('publisher_initialize_failed') + "\n" + initialize_result.error.toString(), undefined)
			return Promise.reject('publisher initialize failed')
		}
	}

	async procPublisherLogin() {
		if (!TitleScenePre.publisher) return Promise.resolve();
		const self = this;
		self.updatePhase('pre pub login.')

		TitleScenePre.publisher.setOnLoginSuccessCallback(function() {
			console.log('login success callback')			
			self.updatePhase('pre pub login..')
			const publisher_uid = `${TitleScenePre.publisher.publisher_uid}`
			console.log('login success publisher_uid : ', publisher_uid)
			_setenv('publisher.uid', publisher_uid)

			console.log('queryEntry start')
			self.queryEntry(function(is_success, version_json, target_version_json) {
				console.log('queryEntry result : ', is_success)
				if (is_success) {
					self.handleEntryResult(version_json, target_version_json)
				} else {
					console.error('queryEntry failed')
				}
			})

			self.ctrls.n_login_before.setVisible(false)
			self.ctrls.n_login_zhs?.setVisible(false)
		})

		TitleScenePre.publisher.setOnLoginFailedCallback(function() {
			console.log('login failed callback')
			self.updatePhase('pre pub login...')
			if (self.publisher_string == "stove") {
				self.ctrls.btn_login_stove.setVisible(true)
			} else {
				const platform = _getenv('platform');
				if (platform == 'win32') {
					self.showNoticePopup( "wegame auth failed:" + _getenv('wegame.error', ''), function() {
						_app_exit();
					})
					return
				} else {
					self.ctrls.btn_login_qq?.setVisible(true)
					self.ctrls.btn_login_wechat?.setVisible(TitleScenePre.publisher.isAppInstalled("wechat"))
					self.ctrls.n_login_zhs?.setVisible(true)
					self.ctrls.n_qr_use?.setVisible(true)
					if (platform == 'iphoneos') {
						self.ctrls.btn_login_apple?.setVisible(true);
					}
				}
			}
			self.ctrls.btn_login_stove.setTouchEnabled(true);
			self.ctrls.btn_login_apple.setTouchEnabled(true);
			self.ctrls.btn_login_qq.setTouchEnabled(true);
			self.ctrls.btn_login_wechat.setTouchEnabled(true);
			self.ctrls.btn_qr_qq.setTouchEnabled(true);
			self.ctrls.btn_qr_wechat.setTouchEnabled(true);
		})

		// show publisher login ui
		this.ctrls.n_login_before.setVisible(true)

		if (this.publisher_string == "stove") {
			if (Util.isPublisherLoginHistoryExists()) {
				this.ctrls.btn_login_stove.setTouchEnabled(false);
				await TitleScenePre.publisher.login()
			} else {
				this.ctrls.btn_login_stove.setVisible(true)
				this.ctrls.btn_login_stove.setTouchEnabled(true);
			}
		} else {
			const platform = _getenv('platform');
			if (platform == 'iphoneos') {
				if( TitleScenePre.publisher.isAppInstalled("wechat") ) {
					this.ctrls.btn_login_wechat.setVisible(true);					
					const btn_pos_0 = this.ctrls.n_btn_pos_0.getPosition()
					const btn_pos_1 = this.ctrls.n_btn_pos_1.getPosition()
					const btn_pos_2 = this.ctrls.n_btn_pos_2.getPosition()

					this.ctrls.btn_login_apple.setPosition( btn_pos_0[0], btn_pos_0[1] );
					this.ctrls.btn_login_wechat.setPosition( btn_pos_1[0], btn_pos_1[1] );
					this.ctrls.btn_login_qq.setPosition( btn_pos_2[0], btn_pos_2[1] );
				} else {
					//위챗 버튼 위치로 표시
					this.ctrls.btn_login_wechat?.setVisible(false);
					const btn_pos = this.ctrls.btn_login_wechat?.getPosition() ?? {x:0,y:0};
					this.ctrls.btn_login_apple?.setPosition( btn_pos[0], btn_pos[1] );
				}
			} else {
			//중국 앱 설치에 따른 로그인 버튼 위치를 조정
			if( !TitleScenePre.publisher.isAppInstalled("wechat") ) {
				this.ctrls.btn_login_wechat.setVisible(false);
			
				const btn_login_pos = this.ctrls.btn_login_stove.getPosition();
				const offsetY = 20;
				this.ctrls.btn_login_qq?.setPosition( btn_login_pos[0], btn_login_pos[1] + offsetY);
			}
			}

			this.ctrls.btn_login_apple?.setTouchEnabled(false);
			this.ctrls.btn_login_qq?.setTouchEnabled(false);
			this.ctrls.btn_login_wechat?.setTouchEnabled(false);
			this.ctrls.btn_qr_qq?.setTouchEnabled(false);
			this.ctrls.btn_qr_wechat?.setTouchEnabled(false);
			await TitleScenePre.publisher.login()
		}
	}

    async handleEntryResult(version_json, target_version_json) {
		console.log('handleEntryResult')
		const self = this;
		self.updateButtonBarState(BUTTON_BAR_STATE.AFTER_INITIALIZE);
        let is_appupgrade = EntryUtil.isAppUpgrade(target_version_json);
        console.log('is_appupgrade : ', is_appupgrade)
        if (is_appupgrade) {
			self.showNoticePopup(PreTexts.getText('app_upgrade_message'), function() {
				let store_url = `${_getenv('store.url')}`;
				console.log('store.url:', store_url);
				if (store_url && store_url.trim() != '') {
					cc.Director.getInstance().openURL(store_url);
				}
			})
            return
        }
		_ad_custom_event('singular','update_check_end', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')

		self.version_json = version_json
		self.target_version_json = target_version_json
		self.updatePhase('pre init..')
		self.updateBuildPatchInfo();
    
		if (!this.world_selector) this.world_selector = new TitleOptionSelectPopup(this, 'ui/overlay_popup_server_select.csb', 'WORLD', this.getTargetLayer())
		if (!this.voice_selector) this.voice_selector = new TitleOptionSelectPopup(this, 'ui/overlay_popup_sound_select.csb', 'VOICE', this.getTargetLayer())
		if (!this.language_selector) this.language_selector = new TitleOptionSelectPopup(this, 'ui/overlay_popup_sound_select.csb', 'LANGUAGE', this.getTargetLayer())		
		if (!this.block_popup) this.block_popup = new TitleBlockPopup(this.getTargetLayer())
		if (!this.confirm_popup) this.confirm_popup = new TitleConfirmPopup(this.getTargetLayer())
		if (!this.confirm_download_popup) this.confirm_download_popup = new TitleConfirmDownloadPopup(this.getTargetLayer())

		if (!this.is_world_user_selected && this.publisher_string != "xcent") {
			// 엔트리 서버 
			// 유저가 월드 선택한 적 없다면 월드 선택하도록 유도
			let is_keep_going_ok = false;
			is_keep_going_ok = await new Promise(function (resolve) {
				self.showWorldSelector(async function(world) {
					if (world !== undefined) {
						Util.setWorldUserSelected(true)
						_ad_custom_event('singular','czn_server_select', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
						if (world === self._selectedWorld) {
							console.log('world is same as selectedWorld')
							resolve(true)
							return
						}
						self._selectedWorld = world
						Util.setSelectedWorld(world)
						self.is_world_user_selected = true
						self.queryEntry(function(is_success, version_json, target_version_json) {
							if (is_success) {
								self.handleEntryResult(version_json, target_version_json)
							} else {
								console.error('queryEntry failed')
							}
						})
						resolve(false)
					}
				})
			})
			if (!is_keep_going_ok) {
				console.log('world has changed')
				return;
			}
		}

        const selected_voice = Util.getSelectedVoice()
        console.log('selected_voice1 : ', selected_voice)
        if (selected_voice == "") {
            let selected_voice = await new Promise(function (resolve) {
                self.showVoiceSelector(async function(value) {
                    console.log('showVoiceSelector value : ', value)
                    _ad_custom_event('singular','czn_voice_select', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
                    await self.timeSleep(500);
                    resolve(value)
                })
            });
            if (selected_voice == undefined) {
                selected_voice = Util.getDefaultVoice()
            }
            console.log('selected_voice2 : ', selected_voice)
            Util.setSelectedVoice(selected_voice)
        }

		self.updatePhase('pre init...')
        self.updateBuildPatchInfo()

        let {is_pre_patch_needed, version_pre_data} = EntryUtil.isPrePatchNeeded(target_version_json)
        console.log('is_pre_patch_needed : ', is_pre_patch_needed)
        if (is_pre_patch_needed) {
			const pre_patch_data = version_pre_data
			global.pre.is_pre_patch = true
			await self.timeSleep(500);
            self.startPrePatch(pre_patch_data);
            return;
        }

        let maintenance_info = EntryUtil.isMaintenance(version_json)
		global.pre.pause_director_after_draw = maintenance_info ? true : false
		console.log('is_maintenance : ', global.pre.pause_director_after_draw)
        if (maintenance_info) {
			self.updatePhase('maintenance')
			self.refreshMaintenance(version_json, target_version_json)
            return;
        }

		self.updatePhase('pre init....')

        if( _getenv( 'xcent.notice', 0 ) ) {
            //공지 데이터 요청
            _xcent_load_notice_data("1", "zh-CN", 0, "0", "extra params");
        } else {
            // end for title animation complete
            self.startPatch()
        }
    }

	startPrePatch(version_pre_data) {
		console.log('startPrePatch')
		const self = this;
		self.updatePhase('prepatching')
        if (version_pre_data.length == 0) {
            console.error('version_pre_data is empty')
            return;
        }
    
        for (let i = 0; i < version_pre_data.length; i++) {
            let pre_data = version_pre_data[i]
            // console.log('pre_data : ', pre_data)
            // pre 키를 current 키로 변환 (예: cdn.version_res.pre -> cdn.version_res.current)
            let current_key = pre_data.key.replace('.pre', '.current')
            _setenv(current_key, pre_data.value)
            console.log('set env : ', current_key, pre_data.value)
        }
    
        global.pre.is_pre_patch = true
        self.showPatchUI(true)
		_setenv("patch.should", "");
        _start_patch()
    }

	startPatch() {
		console.log('startPatch')
		_ad_custom_event('singular','cdn_update_start', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
		const self = this;
		self.updatePhase('patching')
		_perf_gem_post_step_event('login', 2, 0, 0, 'success', '', false, false)
		self.showPatchUI(true)
		if( `${_getenv( 'xcent.dolphin', 0 )}` == "1" ) {
			console.log('start patch dolphin')
			self.updatePhase('patching dolphin')
			_start_patch_dolphin()
	
		} else {
			console.log('start normal patch')
			_setenv("patch.should", "");
			_start_patch()
		}
	}

	async onAfterPatch() {
		console.log('onAfterPatch')
		_ad_custom_event('singular','czn_cdn_finish', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
		const self = this;
		if (global.pre.is_pre_patch) {
			console.log('pre patch complete')
			self.updatePhase('prepatch complete')
			// 만약 사전다운로드였다면, 유저에게 완료 알림을 띄우고 재시작 시킵니다.
			global.pre.is_pre_patch = false
			self.showNoticePopup(PreTexts.getText('pre_patch_complete'))
			return;
		}
		console.log('normal patch complete')
		self.updatePhase('patch complete')

		// 연령등급 표시
		const age_nodes = [];
		const os_lang = Util.getOsLanguage();
		console.log('os_lang : ', os_lang)
		switch (os_lang) {
			// case 'ko':
			// 	age_nodes.push(self.ctrls.n_age_kr);
			// 	break;
			case 'zhs':
				if (`${_getenv("app.pubid")}` == "xcent") {
					age_nodes.push(self.ctrls.btn_age_zhs);
				}
				break;
			case 'zht':
				if (`${_getenv("app.pubid")}` != "xcent") {
					age_nodes.push(self.ctrls.btn_age_tw);
				}
				break;
		}
		for (let i = 0; i < age_nodes.length; i++) {
			age_nodes[i].setVisible(true);
			age_nodes[i].stopAllActions();
			age_nodes[i].setOpacity(0);
			age_nodes[i].runAction(cc.Sequence.create(
				cc.FadeIn.create( 1.5 ),
			));
		}

		// 패치가 완료되었다면, 스크립트단에 제어권을 넘겨줍니다.
		global.pre.is_load_application_resources = true
		self.showPatchUI(false)
		self.update()

		if (self.is_first_patch) {
			// 첫 CDN 다운로드 완료 시 타이틀영상 변경
			self._titleBackground.movieStop();
			self._titleBackground.moviePlay(false);
			// 첫 CDN 다운로드 완료 시 타이틀 로고 보여줌
			self.ctrls.spr_title.setVisible(true);
			self.ctrls.spr_title.stopAllActions();
            let act_engine = cc.Sequence.create(
                cc.DelayTime.create( 1 ) ,
                cc.CallFunc.create( function(){ self.ctrls.spr_title.start() } ),
				cc.CallFunc.create( function(){ 
					if (self.publisher_string == "xcent") {
						return;
					}
				}),
            )
            self.ctrls.spr_title.runAction( act_engine )

			// end for title animation complete
			await self.timeSleep(3000);
		} else {
			// 첫 CDN 다운로드 완료가 아니었더라도 영상 변경이 필요한 경우 변경
			const title_movie_cdn = _getenv("title_movie_cdn", "");
			if (title_movie_cdn && title_movie_cdn.trim() != "") {
				console.log('set last_known_title_movie_cdn :', title_movie_cdn)
				cc.UserDefault.getInstance().setStringForKey("last_known_title_movie_cdn", title_movie_cdn)
			}
			const playing_movie_url = self._titleBackground.getPlayingMovieUrl();
			if (playing_movie_url && playing_movie_url.trim() != title_movie_cdn.trim()) {
				// 영상 재생 변경 필요
				console.log('change title movie to ', title_movie_cdn)
				self._titleBackground.movieStop();
				self._titleBackground.moviePlay(false);
			}
		}
		self.updatePhase('pre init.....')
		_perf_gem_post_step_event('login', 3, 0, 0, 'success', '', false, false)
		self.updatePhase('pre init......')
		ResolutionHandler.destroyInstance();
		
		// _js_stop_profile();
		_load_application_resources()
	}

	timeSleep(ms) {
		const self = this;
		return new Promise(function(resolve) {
			const target_layer = self.getTargetLayer()
			if (target_layer) {
				target_layer.runAction(cc.Sequence.create(
					cc.DelayTime.create(ms / 1000),
					cc.CallFunc.create(function() {
						resolve()
					})
				));
			}
		});
	}

	updatePhase(message) {
		const self = this;
		console.log('updatePhase : ', message)
		self.ctrls.txt_app_status.setString(message)
	}

	updateButtonBarState(state) {
		const self = this;
		console.log('updateButtonBarState : ', state)

		let showing_buttons = [];
		let publisher = Util.getPublisher();
		const platform = _getenv('platform');
		switch (state) {
			case BUTTON_BAR_STATE.HIDDEN:
				{
					
				}
				break;
			case BUTTON_BAR_STATE.AFTER_INITIALIZE:
				{
					if (publisher == "stove" || publisher == "") {
						showing_buttons.push(self.ctrls.n_server_change);
					} else if (publisher == "xcent") {
						//TDODO: 중국 퍼블리셔용 버튼 바
					}
				}
				break;
		}

		for (let i = 0; i < 5; i++) {
            if (self.ctrls.n_btn_right[i] && self.ctrls.n_btn_right[i].getChildrenCount() > 0) {
                self.ctrls.n_btn_right[i].getChildren().forEach(function (child) {
                    child.setVisible(false);
                });
            }
        }
		for (let i = 0; i < showing_buttons.length; i++) {
			console.log('show n_btn_right : ', i)
			showing_buttons[i].setVisible(true);
			showing_buttons[i].ejectFromParent();
			self.ctrls.n_btn_right[i].addChild(showing_buttons[i]);
			self.ctrls.n_btn_right[i].setVisible(true);
		}
		for (let i = showing_buttons.length; i < self.ctrls.n_btn_right.length; i++) {
			console.log('hide n_btn_right : ', i)
			self.ctrls.n_btn_right[i].setVisible(false);
		}
		
	}

	getStoveGCS() {
		console.log('getStoveGCS')
		const gcs = global.pre.stove_gcs;
		console.log('gcs : ', gcs)
		return gcs;
	}
}

exports.TitleScenePre = TitleScenePre