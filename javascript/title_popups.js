'use strict';

Object.defineProperty(exports, "__esModule", { value: true });

const bootres = require( './bootres.js' )
const { PreTexts } = require( './pre_data.js' )
const { Util } = require( './util.js' )
const { ResolutionHandler } = require('./resolution.js');


class TitleConfirmPopup
{
	constructor(parent_layer)
	{
		this.parent_layer = parent_layer;
		this.csb_name = "ui/overlay_popup_confirm_default_long.csb";

		let winSize = cc.Director.getInstance().getWinSize()
		let confirm_popup = cc.CSLoader.createNode( this.csb_name )
		confirm_popup.setOpacity(0)
		confirm_popup.setVisible(false)
		ResolutionHandler.getInstance().alignCenter(confirm_popup);
		this.parent_layer.addChildLast( confirm_popup )
		this.confirm_popup = confirm_popup
	}

	show(title, text, callback)
	{
		if (!_get_cocos_refid(this.parent_layer)) {
			console.log('TitleConfirmPopup: parent_layer not valid')
			return
		}
		
		this.confirm_popup.setVisible(true)
		this.title = title
		this.text = text
		this.callback = callback

		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.setOpacity(0);
		}

		let act_confirm_popup = cc.Sequence.create(
			cc.FadeIn.create( 0.1 )
		)
		this.confirm_popup.runAction( act_confirm_popup )
	
		this.initialize()
	}

	hide()
	{
		if (!_get_cocos_refid(this.parent_layer)) {
			return
		}
		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.runAction(cc.Sequence.create(
				cc.FadeIn.create( 0.5 )
			));
		}
		if (this.confirm_popup) {
			this.confirm_popup.setVisible(false)
		}
	}

	initialize()
	{
		const _this = this;
		this.ctrls = {}
		
		this.ctrls.popup_size = this.confirm_popup.findChildByName( 'popup_size' )
		this.ctrls.text_title = this.confirm_popup.findChildByName( 'text_title' )
		this.ctrls.text_sub = this.confirm_popup.findChildByName( 'text_sub' )
		this.ctrls.btn_confirm = this.confirm_popup.findChildByName( 'btn_confirm' )
		this.ctrls.text_confirm = this.ctrls.btn_confirm.findChildByName( 'text' )
		this.ctrls.btn_cancel = this.confirm_popup.findChildByName( 'btn_cancel' )
		this.ctrls.text_cancel = this.ctrls.btn_cancel.findChildByName( 'text' )

		this.ctrls.text_confirm.setString(PreTexts.getText("btn_confirm"))
		this.ctrls.text_cancel.setString(PreTexts.getText("btn_cancel"))

		this.ctrls.text_title.setString(this.title)
		this.ctrls.text_sub.setString(this.text)

		bootres.addTouchEndEventListener(this.ctrls.btn_confirm, function(_node, sender, state, x, y) {
			const sound_event = ccexp.SoundEngine.getInstance().createEvent("event:/ui/ok");
			if (sound_event) {
				sound_event.start();
			}
			if (_this.callback) {
				_this.callback(true)
			}
			_this.hide()
		})
		
		bootres.addTouchEndEventListener(this.ctrls.btn_cancel, function(_node, sender, state, x, y) {
			const sound_event = ccexp.SoundEngine.getInstance().createEvent("event:/ui/ok");
			if (sound_event) {
				sound_event.start();
			}
			if (_this.callback) {
				_this.callback(false)
			}
			_this.hide()
		})
	}
}
exports.TitleConfirmPopup = TitleConfirmPopup;

class TitleConfirmDownloadPopup
{
	constructor(parent_layer)
	{
		this.parent_layer = parent_layer;
		this.csb_name = "ui/overlay_popup_confirm_download.csb";

		let winSize = cc.Director.getInstance().getWinSize()
		let confirm_popup = cc.CSLoader.createNode( this.csb_name )
		confirm_popup.setOpacity(0)
		confirm_popup.setVisible(false)
		ResolutionHandler.getInstance().alignCenter(confirm_popup);
		this.parent_layer.addChildLast( confirm_popup )
		this.confirm_popup = confirm_popup
	}

	show(download_kb, callback, is_pre_download)
	{
		if (!_get_cocos_refid(this.parent_layer)) {
			console.log('TitleConfirmDownloadPopup: parent_layer not valid')
			return
		}
		
		this.confirm_popup.setVisible(true)
		this.download_kb = download_kb
		this.callback = callback
		this.is_pre_download = is_pre_download

		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.setOpacity(0);
		}

		let act_confirm_popup = cc.Sequence.create(
			cc.FadeIn.create( 0.1 )
		)
		this.confirm_popup.runAction( act_confirm_popup )
	
		this.initialize()
	}

	hide()
	{
		if (!_get_cocos_refid(this.parent_layer)) {
			return
		}
		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.runAction(cc.Sequence.create(
				cc.FadeIn.create( 0.5 )
			));
		}
		if (this.confirm_popup) {
			this.confirm_popup.setVisible(false)
		}
	}

	initialize()
	{
		const _this = this;
		this.ctrls = {}
		
		this.ctrls.popup_size = this.confirm_popup.findChildByName( 'popup_size' )
		this.ctrls.text_title = this.confirm_popup.findChildByName( 'text_title' )
		this.ctrls.text_sub = this.confirm_popup.findChildByName( 'text_sub' )
		this.ctrls.text_main = this.confirm_popup.findChildByName( 'text_main' )
		this.ctrls.text_download = this.confirm_popup.findChildByName( 'text_download' )
		this.ctrls.btn_confirm = this.confirm_popup.findChildByName( 'btn_confirm' )
		this.ctrls.text_confirm = this.ctrls.btn_confirm.findChildByName( 'text' )
		this.ctrls.btn_cancel = this.confirm_popup.findChildByName( 'btn_cancel' )
		this.ctrls.text_cancel = this.ctrls.btn_cancel.findChildByName( 'text' )

		this.ctrls.text_confirm.setString(PreTexts.getText("btn_confirm"))
		this.ctrls.text_cancel.setString(PreTexts.getText("btn_cancel"))

		this.ctrls.text_title.setString(PreTexts.getText("download_cdn_title"))
		if (this.is_pre_download) {
			this.ctrls.text_title.setString(PreTexts.getText("download_cdn_pre_title"))
		}
		const download_gb_str = (this.download_kb / 1024 / 1024).toFixed(2) + PreTexts.getText("gb")
		this.ctrls.text_download.setString(download_gb_str)
		this.ctrls.text_main.setString(PreTexts.getText("download_cdn_main"))
		this.ctrls.text_sub.setString(PreTexts.getText("download_cdn_sub"))

		bootres.addTouchEndEventListener(this.ctrls.btn_confirm, function(_node, sender, state, x, y) {
			const sound_event = ccexp.SoundEngine.getInstance().createEvent("event:/ui/ok");
			if (sound_event) {
				sound_event.start();
			}
			if (_this.callback) {
				_this.callback(true)
			}
			_this.hide()
		})
		
		bootres.addTouchEndEventListener(this.ctrls.btn_cancel, function(_node, sender, state, x, y) {
			const sound_event = ccexp.SoundEngine.getInstance().createEvent("event:/ui/ok");
			if (sound_event) {
				sound_event.start();
			}
			if (_this.callback) {
				_this.callback(false)
			}
			_this.hide()
		})
	}
}
exports.TitleConfirmDownloadPopup = TitleConfirmDownloadPopup;

class TitleBlockPopup
{
	constructor(parent_layer)
	{
		this.parent_layer = parent_layer;
		this.csb_name = "ui/overlay_popup_confirm.csb";
		
		let winSize = cc.Director.getInstance().getWinSize()
		let block_popup = cc.CSLoader.createNode( this.csb_name )
		block_popup.setOpacity(0)
		block_popup.setVisible(false)
		ResolutionHandler.getInstance().alignCenter(block_popup);
		this.parent_layer.addChildLast( block_popup )
		this.block_popup = block_popup
	}

	show(text, callback)
	{
		if (!_get_cocos_refid(this.parent_layer)) {
			console.log('TitleBlockPopup: parent_layer not valid')
			return
		}
		
		this.block_popup.setVisible(true)
		this.text = text
		this.callback = callback

		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.setOpacity(0);
		}

		let act_block_popup = cc.Sequence.create(
			cc.FadeIn.create( 0.1 )
		)
		this.block_popup.runAction( act_block_popup )
	
		this.initialize()
	}

	hide()
	{
		if (!_get_cocos_refid(this.parent_layer)) {
			return
		}
		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.runAction(cc.Sequence.create(
				cc.FadeIn.create( 0.5 )
			));
		}
		if (this.block_popup) {
			this.block_popup.setVisible(false)
		}
	}

	initialize()
	{
		const _this = this;
		this.ctrls = {}
		
		this.ctrls.dim_layer = this.block_popup.findChildByName('dim')
		if (this.ctrls.dim_layer) {
			console.log('dim_layer opacity: ', this.ctrls.dim_layer.getOpacity())
			this.ctrls.dim_layer.setOpacity(192)
		} else {
			console.log('dim_layer not found')
		}
	
		this.ctrls.block_popup_text = this.block_popup.findChildByName( 'main_text' )
		this.ctrls.block_popup_text.setString(this.text)
		this.ctrls.block_popup_text.setTextColor( {r:0, g:0, b:0, a:255} )
		this.ctrls.block_tip_text = this.block_popup.findChildByName( 'text_tip' )
		this.ctrls.block_tip_text?.setString(PreTexts.getText("retry"))
		this.block_popup.setOpacity( 0 )
	
		this.ctrls.block_popup_btn = this.block_popup.findChildByName( 'btn_confirm' )
		bootres.addTouchEndEventListener(this.ctrls.block_popup_btn, function(_node, sender, state, x, y) {
			if (_this.callback) {
				_this.callback()
			} else {
				_this.ctrls.block_popup_btn.setTouchEnabled(false)
				_this.block_popup.removeFromParent()
				_restart_content();
			}
		})
	}
}
exports.TitleBlockPopup = TitleBlockPopup;

class TitleOptionSelectPopup
{
	constructor(title_scene, csb_name, type, parent_layer)
	{
		this.title_scene = title_scene;
		this.csb_name = csb_name;
		this.type = type;
		this.parent_layer = parent_layer;

		let winSize = cc.Director.getInstance().getWinSize()
		let option_selector = cc.CSLoader.createNode( this.csb_name )
		option_selector.setOpacity(0)
		option_selector.setVisible(false)
		ResolutionHandler.getInstance().alignCenter(option_selector);
		this.parent_layer.addChildLast( option_selector )
		this.option_selector = option_selector

		this.option_item_csb = cc.CSLoader.createNode( 'ui/list_server.csb' )
		this.option_item_csb.setAnchorPoint( 0.5, 0.5 )
		this.option_item_csb.setVisible(false)
		this.option_item_csb.setOpacity(0)
		this.option_selector.addChild(this.option_item_csb)
	}

	show( options, callback )
	{
		if (!_get_cocos_refid(this.parent_layer)) {
			console.log('TitleOptionSelectPopup: parent_layer not valid')
			return
		}

		this.options = options;
		this.option_select_callback = callback
		this.option_selector.setVisible(true)

		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.setOpacity(0);
		}

		let act_option_selector = cc.Sequence.create(
			cc.FadeIn.create( 0.1 )
		)
		this.option_selector.runAction( act_option_selector )

		this.initialize()
	}

	hide()
	{
		const _this = this;
		if (!_get_cocos_refid(this.parent_layer)) {
			return
		}
		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.runAction(cc.Sequence.create(
				cc.FadeIn.create( 0.5 ),
			));
		}
		this.option_selector.setVisible(false)
	}

	initialize() {
		const _this = this;
		this.ctrls = {}

		this.ctrls.btn_confirm = this.option_selector.findChildByName( 'btn_confirm' )
		this.ctrls.text_confirm = this.ctrls.btn_confirm.findChildByName( 'text' )
		// this.ctrls.btn_cancel = this.option_selector.findChildByName( 'btn_cancel' )
		// this.ctrls.text_cancel = this.ctrls.btn_cancel.findChildByName( 'text' )

		this.ctrls.scrollview = this.option_selector.findChildByName( 'scrollview' )
		this.ctrls.text_title = this.option_selector.findChildByName( 'text_title' )
		this.ctrls.n_confirm = this.option_selector.findChildByName( 'n_confirm' )
		this.ctrls.text_tip = this.option_selector.findChildByName( 'text_tip' )

		this.ctrls.text_confirm.setString(PreTexts.getText("btn_confirm"))
		// this.ctrls.text_cancel.setString(PreTexts.getText("btn_cancel"))
		switch (this.type) {
			case 'WORLD':
				this.ctrls.text_title.setString(PreTexts.getText("select_server"))
				break
			case 'VOICE':
				this.ctrls.text_title.setString(PreTexts.getText("select_voice"))
				this.ctrls.text_tip.setString(PreTexts.getText("language_change_sub"))
				break
			case 'LANGUAGE':
				this.ctrls.text_title.setString(PreTexts.getText("select_language"))
				this.ctrls.text_tip.setString(PreTexts.getText("language_change_sub"))
				if (_getenv("tgs", false)) {
					this.ctrls.text_tip.setVisible(false)
				}
				break				
		}

		const option_view_count = Math.min(this.options.length, 3)
		const option_count = this.options.length

		this.ctrls.scrollview.setScrollBarEnabled(false)
		this.ctrls.scrollview.setContentSize({width: 800, height: option_view_count * 90})
		this.ctrls.scrollview.setInnerContainerSize({width: 800, height: option_count * 90})
		this.ctrls.scrollview.getChildren().forEach(function(child) {
			child.removeFromParent()
		})
		if (option_count <= 3) {
			this.ctrls.scrollview.setBounceEnabled(false);
		} else {
			this.ctrls.scrollview.setBounceEnabled(true);
		}

		this.ctrls.n_confirm.setPosition(0, 46 - (option_view_count * 90))

		let position_y = -45 + (option_count * 90)

		this.option_items = []
		this.selected_option = undefined
		this.ctrls.btn_confirm.setBright(false);

		const selected_world = this.title_scene._selectedWorld
		if (this.type == 'WORLD' && selected_world !== undefined && selected_world !== "") {
			this.ctrls.btn_confirm.setBright(true);
			this.selected_option = selected_world
		}
		const selected_voice = this.title_scene._selectedVoice
		if (this.type == 'VOICE' && selected_voice !== undefined && selected_voice !== "") {
			this.ctrls.btn_confirm.setBright(true);
		}

		const selected_language = this.title_scene._selectedLanguage
		if (this.type == 'LANGUAGE' && selected_language !== undefined && selected_language !== "") {
			this.ctrls.btn_confirm.setBright(true);
		}

		for (let option of this.options) {
			let option_item_node = this.option_item_csb.clone()
			option_item_node.setOpacity(255)
			option_item_node.setVisible(true)
			option_item_node.setAnchorPoint( 0.5, 0.5 )
			option_item_node.setPosition( 400, position_y )
			position_y -= 90
			let option_item = undefined
			switch (this.type) {
				case 'WORLD':
					{
						option_item = this.initializeWorldItem(option, option_item_node, selected_world == option)
					}
					break
				case 'VOICE':
					{
						option_item = this.initializeVoiceItem(option, option_item_node, selected_voice == option)
					}
					break
				case 'LANGUAGE':
					{
						option_item = this.initializeLanguageItem(option, option_item_node, selected_language == option)
					}
					break					
			}
			this.ctrls.scrollview.addChild(option_item_node)
			this.option_items.push(option_item)
		}

		bootres.addTouchEndEventListener(this.ctrls.btn_confirm, function(_node, sender, state, x, y) {
			const sound_event = ccexp.SoundEngine.getInstance().createEvent("event:/ui/ok");
			if (sound_event) {
				sound_event.start();
			}
			if (_this.selected_option == undefined) {
				return
			}
			_this.hide()
			if (_this.option_select_callback) {
				_this.option_select_callback(_this.selected_option)
			}
		})

		// bootres.addTouchEndEventListener(this.ctrls.btn_cancel, function(_node, sender, state, x, y) {
		// 	_this.hide()
		// 	if (_this.option_select_callback) {
		// 		_this.option_select_callback()
		// 	}
		// })

	}

	initializeWorldItem(option, item, selected) {
		const _this = this;
		console.log('initializeWorldItem : ', option, item)
		const option_item = new TitleOptionItem('world', option, item, function (option) {
			_this.selected_option = option
			_this.ctrls.btn_confirm.setBright(true)
			for (let item of _this.option_items) {
				item.setSelected(item.option == option)
			}
		});
		option_item.initialize(selected)
		return option_item
	}

	initializeVoiceItem(option, item, selected) {
		const _this = this;
		console.log('initializeVoiceItem : ', option, item)
		const option_item = new TitleOptionItem('voice', option, item, function (option) {
			_this.selected_option = option
			_this.ctrls.btn_confirm.setBright(true)
			for (let item of _this.option_items) {
				item.setSelected(item.option == option)
			}
		});
		option_item.initialize(selected)
		return option_item
	}

	initializeLanguageItem(option, item, selected) {
		const _this = this;
		console.log('initializeLanguageItem : ', option, item)
		const option_item = new TitleOptionItem('language', option, item, function (option) {
			_this.selected_option = option
			_this.ctrls.btn_confirm.setBright(true)
			for (let item of _this.option_items) {
				item.setSelected(item.option == option)
			}
		});
		option_item.initialize(selected)
		return option_item
	}
}

class TitleOptionItem
{
	constructor(type, option, item, selected_callback) {
		this.type = type;
		this.option = option;
		this.item = item;
		this.selected = false;
		this.selected_callback = selected_callback;
	}

	initialize(selected) {
		const _this = this;
		this.ctrls = {}

		this.ctrls.n_off = this.item.findChildByName( 'n_off' )
		this.ctrls.n_off.setVisible(true)
		this.ctrls.n_on = this.item.findChildByName( 'n_on' )
		this.ctrls.n_on.setVisible(false)
		this.ctrls.deco_rotation = this.item.findChildByName( 'deco_rotation' )
		this.ctrls.n_server = this.item.findChildByName( 'n_server' )
		this.ctrls.n_server.setVisible(true)
		this.ctrls.icon_account = this.item.findChildByName( 'icon_account' )
		this.ctrls.icon_account.setVisible(false)
		this.ctrls.text_center = this.item.findChildByName( 'text_center' )
		this.ctrls.text_center.setString(this.option)
		this.ctrls.text_server = this.item.findChildByName( 'text_server' )
		this.ctrls.text_server.setString(this.option)
		this.ctrls.btn_server = this.item.findChildByName( 'btn_server' )

		switch (this.type) {
			case 'world':
				{
					this.ctrls.n_server.setVisible(true)
					this.ctrls.text_center.setVisible(false)
				}
				break
			case 'voice':
				{
					this.ctrls.n_server.setVisible(false)
					this.ctrls.text_center.setVisible(true)
					if (this.option == "ko") {
						this.ctrls.text_center.setString(PreTexts.getText("language_korean"))
					} else if (this.option == "en") {
						this.ctrls.text_center.setString(PreTexts.getText("language_english"))
					} else if (this.option == "ja") {
						this.ctrls.text_center.setString(PreTexts.getText("language_japanese"))
					} else if (this.option == "zhs") {
						this.ctrls.text_center.setString(PreTexts.getText("language_chinese"))
					}
				}
				break
			case 'language':
				{
					this.ctrls.n_server.setVisible(false)
					this.ctrls.text_center.setVisible(true)
					if (this.option == "ko") {
						this.ctrls.text_center.setString(PreTexts.getText("language_korean"))
					} else if (this.option == "en") {
						this.ctrls.text_center.setString(PreTexts.getText("language_english"))
					} else if (this.option == "ja") {
						this.ctrls.text_center.setString(PreTexts.getText("language_japanese"))
					}
				}
				break				
		}

		bootres.addTouchEndEventListener(this.ctrls.btn_server, function(_node, sender, state, x, y) {
			const sound_event = ccexp.SoundEngine.getInstance().createEvent("event:/ui/ok");
			if (sound_event) {
				sound_event.start();
			}
			_this.selected_callback(_this.option)
		})

		this.setSelected(selected)
	}

	setSelected(selected) {
		this.selected = selected;

		this.ctrls.n_on.stopAllActions()
		if (this.selected) {
			this.ctrls.n_off.setVisible(false)
			this.ctrls.n_on.setVisible(true)

			this.ctrls.deco_rotation.runAction(cc.RepeatForever.create(cc.RotateBy.create(15, 360)));
			this.ctrls.text_server.setColor(new cc.Color( 239, 120, 41 ));
			this.ctrls.text_center.setColor(new cc.Color( 239, 120, 41 ));
			this.ctrls.icon_account.setVisible(true);
			this.ctrls.icon_account.setColor(new cc.Color( 255, 201, 120 ));

		} else {
			this.ctrls.n_off.setVisible(true)
			this.ctrls.n_on.setVisible(false)
			
			this.ctrls.text_server.setColor(new cc.Color( 74, 74, 74 ));
			this.ctrls.text_center.setColor(new cc.Color( 74, 74, 74 ));
			this.ctrls.icon_account.setVisible(true);
			this.ctrls.icon_account.setColor(new cc.Color( 207, 207, 207 ));
		}
	}
}
exports.TitleOptionSelectPopup = TitleOptionSelectPopup;
exports.TitleOptionItem = TitleOptionItem;

class TitleXcentNoticePopup
{
	constructor()
	{

	}

	show( parent )
	{
		if( _get_cocos_refid( this.scene ) )
		{
			this.scene.ejectFromParent()
			parent.addChild( this.scene )
		}
	}

	hide()
	{
		if( _get_cocos_refid( this.scene ) )
		{
			this.scene.removeFromParent()
		}
		this.scene = undefined
	}

	createScene(custom_callback)
	{
		if( _get_cocos_refid( this.scene ) ) return this.scene

		let winSize = cc.Director.getInstance().getWinSize()

		let noticeWin   = cc.CSLoader.createNode( 'ui/overlay_popup_xcent_notice.csb' )
		ResolutionHandler.getInstance().alignCenter( noticeWin );

		let scene = cc.Layer.create()

		scene.addChild( noticeWin )
		this.scene = scene

		this.ctrls = {}
		this.ctrls.btn_close = noticeWin.findChildByName( 'btn_close' )
		this.ctrls.btn_close_s = noticeWin.findChildByName( 'btn_close_s' )

		this.ctrls.text_title = noticeWin.findChildByName( 'text_title' )
		this.ctrls.text_info = noticeWin.findChildByName( 'text_info' )
		this.ctrls.text_info.ejectFromParent()
		this.ctrls.listview = noticeWin.findChildByName( 'listview' )
		this.ctrls.listview.addChild(this.ctrls.text_info)

		if (this.ctrls.btn_close) {
			var _this2 = this;
			bootres.addTouchEndEventListener(this.ctrls.btn_close, function(_node, sender, state, x, y) {
				_this2.scene.setVisible(false);
				_this2.scene.ejectFromParent()
				if(custom_callback) {
					custom_callback()
				}
				_this2.hide()
			})
		}

		if(this.ctrls.btn_close_s) {
			var _this3 = this;
			bootres.addTouchEndEventListener(this.ctrls.btn_close_s, function(_node, sender, state, x, y) {
				_this3.scene.setVisible(false);
				_this3.scene.ejectFromParent()
				if(custom_callback) {
					custom_callback()
				}
				_this3.hide()
			})
		}

		return this.scene
	}

	setNotice( title , message )
	{
		if( _get_cocos_refid( this.scene ) )
		{
			this.ctrls.text_title.setString(title)
			if(message) {
				message = message.replace(/<br>/g, '\n')
			}
			this.ctrls.text_info.setString(message)

			let cs_size = this.ctrls.text_info.getTextBoxSize()
			//console.log('cs_size: ', cs_size.width, cs_size.height)

			this.ctrls.text_info.setTextAreaSize(
				{
					width: this.ctrls.listview.getContentSize().width,
					height: cs_size.height,
				}
			)
			this.ctrls.listview.requestDoLayout();
		}
	}
}
exports.TitleXcentNoticePopup = TitleXcentNoticePopup

class TitlePermissionPopup
{
	constructor(title_scene, csb_name, parent_layer)
	{
		this.title_scene = title_scene;
		this.csb_name = csb_name;
		this.parent_layer = parent_layer;

		let winSize = cc.Director.getInstance().getWinSize()
		let permission_popup = cc.CSLoader.createNode( this.csb_name )
		permission_popup.setOpacity(0)
		permission_popup.setVisible(false)
		ResolutionHandler.getInstance().alignCenter(permission_popup);
		this.parent_layer.addChildLast( permission_popup )
		this.permission_popup = permission_popup

		this.permission_item_csb = cc.CSLoader.createNode( 'ui/list_authority.csb' )
		this.permission_item_csb.setAnchorPoint( 0.5, 0.5 )
		this.permission_item_csb.setVisible(false)
		this.permission_item_csb.setOpacity(0)
		this.permission_popup.addChild(this.permission_item_csb)
	}

	show( callback )
	{
		if (!_get_cocos_refid(this.parent_layer)) {
			console.log('TitlePermissionPopup: parent_layer not valid')
			return
		}

		this.permission_select_callback = callback
		this.permission_popup.setVisible(true)

		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.setOpacity(0);
		}

		let act_permission_popup = cc.Sequence.create(
			cc.FadeIn.create( 0.2 )
		)
		this.permission_popup.runAction( act_permission_popup )

		this.initialize()
	}

	hide()
	{
		const _this = this;
		if (!_get_cocos_refid(this.parent_layer)) {
			return
		}
		const spr_title = this.parent_layer?.ctrls?.spr_title;
		if (spr_title) {
			spr_title.stopAllActions();
			spr_title.runAction(cc.Sequence.create(
				cc.FadeIn.create( 0.5 ),
			));
		}

		let act_permission_popup = cc.Sequence.create(
			cc.FadeOut.create( 0.2 ),
			cc.CallFunc.create(function() {
				_this.permission_popup.setVisible(false)
			})
		)
		this.permission_popup.runAction( act_permission_popup )
	}

	initialize() {
		const _this = this;
		this.ctrls = {}

		this.ctrls.btn_confirm = this.permission_popup.findChildByName( 'btn_confirm' )
		this.ctrls.text_confirm = this.ctrls.btn_confirm.findChildByName( 'text' )
		// this.ctrls.btn_cancel = this.option_selector.findChildByName( 'btn_cancel' )
		// this.ctrls.text_cancel = this.ctrls.btn_cancel.findChildByName( 'text' )

		this.ctrls.scrollview = this.permission_popup.findChildByName( 'scrollview' )
		this.ctrls.scrollview.setAnchorPoint(0.5, 1);
		this.ctrls.text_title = this.permission_popup.findChildByName( 'title' )
		this.ctrls.n_confirm = this.permission_popup.findChildByName( 'n_confirm' )
		this.ctrls.text_tip = this.permission_popup.findChildByName( 'text_tip' )
		this.ctrls.btn_close = this.permission_popup.findChildByName( 'btn_close' )

		this.ctrls.text_confirm.setString(PreTexts.getText("btn_confirm"))

		bootres.addTouchEndEventListener(this.ctrls.btn_close, function(_node, sender, state, x, y) {
			if (_this.permission_select_callback) {
				_this.permission_select_callback()
			}
		})

		bootres.addTouchEndEventListener(this.ctrls.btn_confirm, function(_node, sender, state, x, y) {
			if (_this.permission_select_callback) {
				_this.permission_select_callback()
			}
		})

		this.ctrls.scrollview.setScrollBarEnabled(false)
		// this.ctrls.scrollview.setContentSize({width: 784, height: option_view_count * 90})
		// this.ctrls.scrollview.setInnerContainerSize({width: 800, height: option_count * 90})
		this.ctrls.scrollview.getChildren().forEach(function(child) {
			child.removeFromParent()
		})

		let original_scrollview_height = 434;
		let position_y = 434;

		this.permission_items = [];


		const permission_camera = this.makePermissionItem(this.permission_item_csb, PreTexts.getText("permission_camera_title"), false, PreTexts.getText("permission_camera_description"));
		permission_camera.item.setPositionY(position_y);
		position_y -= permission_camera.getHeight();
		this.ctrls.scrollview.addChild(permission_camera.item);
		this.permission_items.push(permission_camera);

		const permission_microphone = this.makePermissionItem(this.permission_item_csb, PreTexts.getText("permission_microphone_title"), false, PreTexts.getText("permission_microphone_description"));
		permission_microphone.item.setPositionY(position_y);
		position_y -= permission_microphone.getHeight();
		this.ctrls.scrollview.addChild(permission_microphone.item);
		this.permission_items.push(permission_microphone);
		
		const permission_tracking = this.makePermissionItem(this.permission_item_csb, PreTexts.getText("permission_tracking_title"), false, PreTexts.getText("permission_tracking_description"));
		permission_tracking.item.setPositionY(position_y);
		position_y -= permission_tracking.getHeight();
		this.ctrls.scrollview.addChild(permission_tracking.item);
		this.permission_items.push(permission_tracking);

		const permission_push = this.makePermissionItem(this.permission_item_csb, PreTexts.getText("permission_push_title"), false, PreTexts.getText("permission_push_description"));
		permission_push.item.setPositionY(position_y);
		position_y -= permission_push.getHeight();
		this.ctrls.scrollview.addChild(permission_push.item);
		this.permission_items.push(permission_push);

		const permission_photo = this.makePermissionItem(this.permission_item_csb, PreTexts.getText("permission_photo_title"), false, PreTexts.getText("permission_photo_description"), PreTexts.getText("permission_photo_addition"));
		permission_photo.item.setPositionY(position_y);
		position_y -= permission_photo.getHeight();
		this.ctrls.scrollview.addChild(permission_photo.item);
		this.permission_items.push(permission_photo);
	}

	makePermissionItem(item_original, title, is_required, description, additional_description) {
		const permission_item_node = item_original.clone();
		permission_item_node.setAnchorPoint(0, 1);
		const permission_item = new TitlePermissionItem(permission_item_node, title, is_required, description, additional_description)
		permission_item.initialize();
		permission_item_node.setVisible(true);
		permission_item_node.setOpacity(255);
		return permission_item;
	}

}

class TitlePermissionItem
{
	constructor(item, title, is_required, description, additional_description) {
		this.item = item;
		this.title = title;
		this.is_required = is_required;
		this.description = description;
		this.additional_description = additional_description;
		this.height = 0;
	}

	initialize() {
		const _this = this;
		this.ctrls = {}

		this.ctrls.text_title = this.item.findChildByName( 'text_title' )
		this.ctrls.text_title.ignoreContentAdaptWithSize(true)
		this.ctrls.text_sub = this.item.findChildByName( 'text_sub' )
		this.ctrls.text_sub.ignoreContentAdaptWithSize(true)
		this.ctrls.text_info = this.item.findChildByName( 'text_info' )
		this.ctrls.text_info.ignoreContentAdaptWithSize(true)
		this.ctrls.bg_list = this.item.findChildByName( 'bg_list' )
		this.height = this.ctrls.bg_list.getContentSize().height;

		const title = this.title
		this.ctrls.text_title.setString(title)
		// this.ctrls.text_title.setColor(new cc.Color(74, 74, 74));

		const sub = "[" + (this.is_required ? PreTexts.getText("permission_popup_required") : PreTexts.getText("permission_popup_optional")) + "]"
		this.ctrls.text_sub.setString(sub)
		// this.ctrls.text_sub.setColor(new cc.Color(239, 120, 41));

		const pos_x = this.ctrls.text_title.getPositionX() + (this.ctrls.text_title.getContentSize().width * this.ctrls.text_title.getScaleX()) - 4;
		this.ctrls.text_sub.setPositionX(pos_x)
		
		const original_description_height = this.ctrls.text_info.getContentSize().height;
		if (this.additional_description) {
			this.ctrls.text_info.setString(this.description + "\n" + this.additional_description)
		} else {
			this.ctrls.text_info.setString(this.description)
		}
		const new_description_height = this.ctrls.text_info.getContentSize().height;
		const height_diff = new_description_height - original_description_height;
		console.log('height_diff: ', height_diff)
		this.height += (height_diff * 0.7);

		this.ctrls.bg_list.setContentSize({width: this.ctrls.bg_list.getContentSize().width, height: this.height})
	}

	getHeight() {
		return this.height + 8;
	}
}
exports.TitlePermissionPopup = TitlePermissionPopup;
exports.TitlePermissionItem = TitlePermissionItem;