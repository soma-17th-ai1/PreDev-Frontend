import { monogatari } from './engine.js';
import { gotoNextScene, findJumpLLMChatStep } from './scene-router.js';
import {
	showIntroLogo,
	updateSeraSprite,
	resetSeraSprite,
	showThinkingDots,
	hideThinkingDots,
	ensureHUD,
	updateHUD,
	hideHUD,
	pushDialogLog,
	pushRecentMessagesToDialogLog,
	clearDialogLogDom,
	ensureLogButton,
	typewriteAndAwait,
	showEndCredits,
	showEndingImage,
	lockToBlack
} from './ui.js';
import { startSseStream, playChatTypewriter } from './chat-stream.js';
import { bootstrapSessionOnce, fetchEndingContent } from './api.js';
import { saveEndingClear } from './ending-dex.js';
import { setGameActive, chatStreamState, finalizeEndingCleanup } from './game-flow.js';
import { API_BASE, escapeDialogText, ENDING_BG_FADE_MS, ENDING_BG_FADE_OUT_MS, SCENE_BG_KEY, SCENE_FILE } from './constants.js';
import { bgm } from './audio.js';

// ─── Monogatari 등록 ───────────────────────────────────────────────────────────

monogatari.action ('message').messages ({
	'Help': {
		title: 'Help',
		subtitle: 'Some useful Links',
		body: `
			<p><a href='https://developers.monogatari.io/documentation/'>Documentation</a> - Everything you need to know.</p>
			<p><a href='https://monogatari.io/demo/'>Demo</a> - A simple Demo.</p>
		`
	}
});

monogatari.action ('notification').notifications ({
	'Welcome': {
		title: 'Welcome',
		body: 'This is the Monogatari VN Engine',
		icon: ''
	}
});

monogatari.assets ('images', {
	'sera_first': 'sera_first.png'
});

monogatari.assets ('scenes', SCENE_FILE);

monogatari.characters ({
	'p': {
		name: '{{player.name}}',
		color: '#8ad8ff'
	},
	'y': {
		name: '{{sera.name}}',
		color: '#ffb7d8',
		directory: '이세라_표정/이세라_표정',
		sprites: {
			calm: '평온.png',
			happy: '행복.png',
			shy: '수줍음.png',
			sad: '슬픔.png',
			angry: '화남.png',
			disgust: '혐오.png',
			excited: '흥분(좋은의미).png'
		}
	}
});

monogatari.translation ('한국어', {
	'↑': '↑'
});

// ─── 시나리오 라벨 ──────────────────────────────────────────────────────────────

monogatari.script ({
	'Start': [
		function () { setGameActive (true); return true; },
		// 인트로 직전 — blank_white SVG 로 즉시 흰 배경.
		'show scene blank_white',
		// 인트로 로고 오버레이.
		showIntroLogo,
		// 인트로 끝나면 검은 배경으로 페이드.
		'show scene fade_black with fadeIn',
		'jump NewGame'
	],

	'NewGame': [
		// === 씬 1: 이름 입력 ===
		{
			'Input': {
				'Text': '당신의 이름을 알려주세요.',
				'Validation': function (input) {
					return /^([가-힣]{2,6}|[A-Za-z]{2,12})$/.test (input.trim ());
				},
				'Save': function (input) {
					this.storage ({
						player: {
							name: input.trim ()
						}
					});
					return true;
				},
				'Revert': function () {
					this.storage ({
						player: {
							name: '???'
						}
					});
				},
				'Warning': '한글 2~6자 또는 영문 2~12자로 입력해 주세요.'
			}
		},

		'show scene bedroom_dawn with fadeIn',
		'4월 13일, 월요일. 화창한 아침.',
		'또로로롱~ 오니쨩~! 일어날 시간이에요!!',
		'또로로롱~ 오니쨩~! 일어날 시간이에요!!',
		'…뚝.',
		'p 으… 아침인가… 벌써 시간이…',
		'p 일어나서 씻어야지…',
		'저벅… 저벅… 툭. 샤아아아아—',
		'…툭. 위이이이잉… 딸깍. 툭.',
		'p 하아… 이제야 좀 상쾌하네. 오늘은 처음 센터에 가는 날이니까 빨리 준비해야지.',
		'철컥— 현관문이 닫힌다.',

		'show scene train_interior with fadeIn',
		'쿠구구궁… 덜컹… 덜컹…',
		'p 이건 탈 때마다 왜 이리 시끄러워…',
		'끼이이익… 덜컹… 슈우우우욱.',

		'show scene posttower_lobby with fadeIn',
		'저벅… 저벅…',
		'p 오, 여기가 소마 건물이구나. 7층이었지, 아마?',
		'건물로 들어간다.',

		'show scene center_hall with fadeIn',
		'p 오오! 이곳이 센터구나. 안이 생각보다 훨씬 깔끔한걸?',
		'운 좋게 소프트웨어 마에스트로에 합격한 나는, 워크숍이 끝나고 처음으로 센터에 발을 들였다.',
		'p 센터 오픈 첫날이라 그런지 사람이 꽤 많네…! 워크숍 때는 제대로 얘기를 못해봤지만… 오늘은 꼭 팀원을 구해야지!',
		'p 워크숍 때 봤던 그녀도 있을까…? 꼭 다시 만나보고 싶어.',
		'지난주 워크숍에서 간식을 너무 많이 먹은 탓에 혈당 스파이크가 왔고, 결국 중간에 골아 떨어지는 바람에 네트워킹을 제대로 못했다. 정확히는 18번 테이블의 초코파이 20개가 원흉이었다.',
		'p 앞으로 간식은 자제하자…',
		'안쪽으로 발걸음을 옮긴다.',
		'p 이야, 벌써 서로 안면을 텄구나. 나도 워크숍 때 좀 잘할걸 그랬네…',
		'p 아니야, 지금도 늦지 않았어. 열심히 네트워킹하자!',

		'show scene s1_room with fadeIn',
		'— S1 룸 —',
		'p 아, 여기가 그곳이구나! 내가 면접 봤던 곳… 그땐 좁아 보였는데, 벽을 치우니까 엄청 넓네.',
		'저벅… 저벅… 툭.',
		'p 어?',
		'p 어..? 어…???? 아닛, 저 사람은…?',

		'show image sera_first with fadeIn',
		'창가 앞, 화사한 햇볕이 내리쬐는 자리. 신비로운 분위기의 소녀가 앉아 있었다.',
		'천사의 날개 같은 흰 머리, 사람을 홀리는 듯한 파란 눈, 가녀린 속눈썹, 보호본능을 자극하는 가녀린 체구. 그야말로 나의 이상향과 같은 존재였다.',
		'그녀의 노트북 화면엔 검은 터미널 위로 GDB 프롬프트가 깜빡이고, 옆에는 다 식어버린 아메리카노가 놓여 있었다.',
		'hide image sera_first with fadeOut',
		'jump SCENE_FIRST_MEET'
	],

	// 구조: [<프롤로그>, 'jump LLMChatInit', <에필로그>, gotoNextScene]
	'SCENE_FIRST_MEET': [
		'show character y calm with fadeIn',
		'p 그때 워크숍 때 봤던 사람이잖아…? 다시 봐도 정말 눈에 띄네.',
		'p 그때 잠깐 이야기 듣다 보니 관심사가 나랑 비슷한 것 같았어. 지금이라도 한 번 말을 걸어봐야겠다…!',
		'그녀 앞으로 조심스럽게 다가간다.',
		'p 저… 저기요…!',
		'y …?',
		'p 그… 저… 혹시… 저, 기억하시나요…?',
		'y 응? 아니아니, 누구신데요?',
		'그녀가 잠시 나를 바라보더니, 뭔가 떠오른 듯 눈이 살짝 커졌다.',
		'show character y happy',
		'y 아…! 그때 워크숍 18번 테이블에서 초코파이 드시던 분이세요?',
		'p 네…! 기억해주셨군요!! 저, {{player.name}}이에요.',
		{
			'Function': {
				'Apply': function () {
					this.storage ({ sera: { name: '이세라' } });
					return true;
				},
				'Revert': function () {
					this.storage ({ sera: { name: '???' } });
					return true;
				}
			}
		},
		'y 오, 그분이셨구나? 안녕하세요. 저는 이세라라고 해요.',
		'show character y calm',
		'y 잘 부탁드려요, {{player.name}}씨.',
		'p 반갑습니다…!',
		'p (어색한 첫 인사는 끝났다. 이제 뭐라고 말을 꺼내지…)',
		'jump LLMChatInit',
		// === 에필로그 ===
		'show character y happy',
		'어색하면서도 즐거웠던 첫 대화. 우리는 어쩌다 같은 팀이 되기로 했다.',
		'y 그럼… 우리 같이 잘 해봐요!',
		'p 네! 잘 부탁드려요.',
		gotoNextScene
	],

	'SCENE_PROJECT_PLAN_EVALUATION': [
		'show scene scene_project_plan_evaluation with fadeIn',
		'show character y calm with fadeIn',
		'며칠 후, 첫 번째 관문인 기획 심의 날이 다가왔다.',
		'p 드디어 발표 날이네… 잘할 수 있을까?',
		'y 긴장돼요? 우리 충분히 준비했으니까 괜찮을 거예요.',
		'jump LLMChatInit',
		// === 에필로그 ===
		'show character y happy',
		'무사히 기획 심의를 마치고, 우리는 다음 일정으로 향했다.',
		'y 휴~ 무사히 끝났네요. 수고하셨어요!',
		'p 다행이다… 이제 발대식이지?',
		gotoNextScene
	],

	'SCENE_LAUNCH_CEREMONY': [
		'show scene scene_launch_ceremony with fadeIn',
		'show character y excited with fadeIn',
		'정장 차림의 사람들로 가득 찬 회장. 발대식이 시작되려 한다.',
		'p 이렇게 사람이 많을 줄이야…',
		'y 우와… 진짜 정식으로 시작되는 느낌이네요.',
		'jump LLMChatInit',
		'show character y excited',
		'발대식이 끝나고, 우리는 본격적인 개발 모드로 들어갔다.',
		'y 자! 이제부터 진짜 시작이에요!',
		'p 응! 열심히 하자.',
		gotoNextScene
	],

	'SCENE_MID_EVALUATION': [
		'show scene scene_mid_evaluation with fadeIn',
		'show character y calm with fadeIn',
		'어느새 중간 평가가 다가왔다.',
		'p 벌써 중간 평가네… 시간 진짜 빠르다.',
		'y 그러게요… 잘 해봐요, 우리.',
		'jump LLMChatInit',
		'show character y sad',
		'길고 긴 중간 평가가 끝났다.',
		'y 후… 멘토님들 질문이 진짜 매서웠네요.',
		'p 그래도 잘 막아낸 것 같아.',
		gotoNextScene
	],

	'SCENE_DEEP_DEV': [
		'show scene scene_deep_dev with fadeIn',
		'show character y shy with fadeIn',
		'마감이 다가오자 우리는 센터에서 밤을 새기로 했다.',
		'y 새벽까지 코딩이라니… 좀 떨려요.',
		'p 카페인 챙겨왔어. 같이 끝내자!',
		'jump LLMChatInit',
		'show character y happy',
		'동이 트는 창밖을 바라보며, 우리는 마지막 커밋을 푸시했다.',
		'y 우리… 진짜 해냈네요…',
		'p 응. 같이라서 가능했어.',
		gotoNextScene
	],

	'SCENE_FINAL_EVALUATION': [
		'show scene scene_final_evaluation with fadeIn',
		'show character y calm with fadeIn',
		'마지막 발표의 날. 모두의 시선이 우리에게 모였다.',
		'p 여기까지 왔구나… 잘하자!',
		'y 우리가 만든 거, 그대로 보여주기만 하면 돼요.',
		'jump LLMChatInit',
		'show character y excited',
		'박수 소리와 함께 발표가 끝났다.',
		'y 진짜 끝났다… 믿기지 않아요.',
		'p 수고했어. 정말 수고했어.',
		gotoNextScene
	],

	'SCENE_GRADUATION_BUSAN': [
		'show scene scene_graduation_busan with fadeIn',
		'show character y calm with fadeIn',
		'부산행 KTX. 차창 밖으로 흘러가는 풍경이 어쩐지 아쉽다.',
		'y 부산이라니… 진짜 마지막 같아요.',
		'p 그러게… 1년이 진짜 빨리 갔다.',
		'jump LLMChatInit',
		'show character y calm',
		'행사가 끝났다. 1년이 지나간 것이, 실감이 나지 않았다.',
		'y 이제 진짜 끝이네요…',
		gotoNextScene
	],

	// 개발용 LLMChatInit 진입 씬
	'DevStart' : [
		'show scene s1_room',
		'show character y calm',
		'jump LLMChatInit'
	],

	// 씬 전환 디스패처 — LLMChat Conditional 의 'transition' 분기에서 진입.
	'_TransitionDispatch': [
		function () {
			const llm = monogatari.storage ('llm') || {};
			const prev = llm.prev_scene_id || '';
			const jumpIdx = findJumpLLMChatStep (prev);
			if (jumpIdx >= 0) {
				monogatari.state ({ label: prev, step: jumpIdx });
				return true;
			}
			return gotoNextScene ();
		}
	],

	'LLMChatInit': [
		async function () {
			const boot = this.storage ('boot') || {};
			const game = this.storage ('game') || {};
			const playerName = (this.storage ('player') || {}).name || '플레이어';

			setGameActive (true);
			// resume 경로는 handleResume 이 setSessionBootstrapped() 로 마킹 → bootstrap 스킵.
			if (boot.mode !== 'resume' && boot.mode !== 'loaded-slot') {
				await bootstrapSessionOnce (playerName);
			}
			ensureHUD ();
			updateHUD ({
				progress: typeof game.progress === 'number' ? game.progress : 0,
				affinity: typeof game.affinity === 'number' ? game.affinity : 0
			});
			resetSeraSprite ();

			if (boot.mode === 'resume' || boot.mode === 'loaded-slot') {
				const recent = Array.isArray (boot.recent_messages) ? boot.recent_messages : [];
				console.debug ('[resume] restoring dialog log from BE recent_messages:', recent.length, 'entries');
				clearDialogLogDom ();
				if (recent.length > 0) {
					pushRecentMessagesToDialogLog (recent, playerName);
				}
				const sayEl = document.querySelector ('[data-ui="say"]');
				const whoEl = document.querySelector ('[data-ui="who"]');
				if (sayEl) sayEl.innerHTML = '';
				if (whoEl) whoEl.textContent = '';
				// 저장된 마지막 감정에 맞는 스프라이트 복원.
				const llmStorage = this.storage ('llm') || {};
				if (llmStorage.emotion) updateSeraSprite (llmStorage.emotion);
				this.storage ({ boot: Object.assign ({}, boot, { mode: boot.mode + '-played' }) });
			}

			const prevLLM = this.storage ('llm') || {};
			this.storage ({
				llm: Object.assign ({}, prevLLM, {
					prompt: '',
					response: '',
					event_id: ''
				})
			});
			return true;
		},
		'jump LLMChatLoop'
	],

	'LLMChatLoop': [
		{
			'Input': {
				'Text': '',
				'Type': 'textarea',
				'Class': 'llm-input',
				'Attributes': {
					'rows': '1',
					'maxlength': '300',
					'placeholder': '이세라에게 말을 걸어보세요…'
				},
				'Validation': function (input) {
					const trimmed = input.trim ();
					return trimmed.length >= 1 && trimmed.length <= 300;
				},
				'Save': function (input) {
					const prompt = input.trim ();
					const prevLLM = this.storage ('llm') || {};
					this.storage ({
						llm: Object.assign ({}, prevLLM, {
							prompt: escapeDialogText (prompt),
							response: '',
							emotion: 'NEUTRAL',
							event_id: '',
							next_scene_id: '',
							prev_scene_id: ''
						})
					});

					chatStreamState.pending = fetch (`${API_BASE}/chat`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'text/event-stream'
						},
						credentials: 'include',
						body: JSON.stringify ({ message: prompt })
					});

					return true;
				},
				'Revert': function () {
					const prevLLM = this.storage ('llm') || {};
					this.storage ({
						llm: Object.assign ({}, prevLLM, {
							prompt: '',
							response: '',
							emotion: 'NEUTRAL',
							event_id: ''
						})
					});
				},
				'Warning': '1자 이상 300자 이하로 입력해 주세요.',
				'actionString': '↑'
			}
		},

		'p {{llm.prompt}}',

		async function () {
			const sayEl = document.querySelector ('[data-ui="say"]');
			const whoEl = document.querySelector ('[data-ui="who"]');
			if (whoEl) whoEl.textContent = '이세라';
			if (!chatStreamState.pending) {
				console.warn ('[chat] skipped stale chat step without a pending stream');
				const prevLLM = this.storage ('llm') || {};
				this.storage ({
					llm: Object.assign ({}, prevLLM, { prompt: '', response: '', event_id: '' })
				});
				return true;
			}
			showThinkingDots ();
			const stream = startSseStream (chatStreamState.pending);
			chatStreamState.pending = null;

			while (!stream.metaArrived && !stream.done && stream.buffer.length === 0) {
				await new Promise (r => setTimeout (r, 50));
			}
			hideThinkingDots ();
			sayEl.innerHTML = '';

			await playChatTypewriter (sayEl, stream);

			if (stream.buffer.trim ()) {
				pushDialogLog ({
					id: 'y',
					name: '이세라',
					color: '#ffb7d8',
					dialog: escapeDialogText (stream.buffer)
				});
			}

			const prevGame = this.storage ('game') || {};
			if (stream.lastState) {
				const s = stream.lastState;
				this.storage ({
					game: {
						affinity:         typeof s.affinity       === 'number' ? s.affinity       : prevGame.affinity      || 0,
						affinity_delta:   typeof s.affinity_delta  === 'number' ? s.affinity_delta  : 0,
						progress:         typeof s.progress        === 'number' ? s.progress        : prevGame.progress      || 0,
						chat_count:       typeof s.chat_count      === 'number' ? s.chat_count      : prevGame.chat_count    || 0,
						current_scene_id: prevGame.current_scene_id || 'SCENE_FIRST_MEET'
					}
				});
			}

			this.storage ({
				llm: {
					prompt:        this.storage ('llm').prompt,
					response:      stream.buffer,
					emotion:       stream.lastState?.emotion || 'NEUTRAL',
					event_id:      stream.triggeredEventId || '',
					next_scene_id: stream.nextSceneId || '',
					prev_scene_id: stream.nextSceneId ? (prevGame.current_scene_id || '') : ''
				}
			});

			return true;
		},

		{
			'Conditional': {
				'Condition': function () {
					const llm = this.storage ('llm') || {};
					if (llm.next_scene_id) return 'transition';
					return 'continue';
				},
				'continue': 'jump LLMChatLoop',
				'transition': 'jump _TransitionDispatch'
			}
		}
	],

	// 모든 엔딩의 진입점 — HUD 숨김 후 배경 전환하여 해당 엔딩 씬으로 점프.
	// 호감도 30+ 의 두 해피엔딩(HAPPY/MARRIAGE)은 광안리 바닷가에서, 그 외는 수료식 배경에서 대사 진행.
	'Ending': [
		async function () {
			hideThinkingDots ();
			hideHUD ();
			const game = this.storage ('game') || {};
			const sceneId = game.current_scene_id || '';
			const isHappy = (sceneId === 'SCENE_ENDING_HAPPY' || sceneId === 'SCENE_ENDING_MARRIAGE');
			const isInstantBad = (sceneId === 'SCENE_ENDING_INSTANT_BAD');
			if (isHappy) bgm ('gwanganli');
			if (!isInstantBad) {
				const introBg = isHappy ? 'scene_beach_gwangalli' : 'scene_graduation_busan';
				try { await monogatari.run ('show scene ' + introBg + ' with fadeIn', false); } catch (e) {}
			}
			const label = (sceneId.startsWith('SCENE_') ? sceneId.slice(6) : 'ENDING_BAD');
			monogatari.state ({ label, step: -1 });
			return true;
		}
	],

	// 즉시 베드엔딩 — 호감도 -100 인터럽트
	'ENDING_INSTANT_BAD': [
		'show character y angry with fadeIn',
		'y 잠깐만요.',
		'y 저, 지금 이 대화 더 이상 이어가기 힘들 것 같아요.',
		'show character y disgust',
		'y 솔직히 말할게요. 이 자리에 계속 있고 싶지 않아요.',
		'그녀는 자리에서 일어나 가방을 챙겼다.',
		'hide character y with fadeOut',
		'어떤 말도 그녀의 발걸음을 붙잡지 못했다.',
		'문이 닫혔다. 그게 전부였다.',
		'우리의 이야기는, 그렇게 끝났다.',
		'jump EndingImageHold'
	],

	// 일반 배드엔딩 — 호감도 ≤ -30
	'ENDING_BAD': [
		'show character y sad with fadeIn',
		'수료식이 끝나고, 짧은 인사를 나눴다.',
		'y 수고하셨어요.',
		'p 어… 너도.',
		'그뿐이었다.',
		'hide character y with fadeOut',
		'그 후로 연락은 없었다. 서로의 번호가 연락처에 남아 있었지만, 아무도 먼저 전화하지 않았다.',
		'어느 날 우연히 그녀의 SNS를 검색했는데, 차단되어 있었다.',
		'그제야 실감이 났다. 우리 사이는, 정말로 끝난 거라고.',
		'jump EndingImageHold'
	],

	// 노멀엔딩 1 — 연락 없음 (-29 ≤ 호감도 ≤ 0)
	'ENDING_NORMAL_NO_CONTACT': [
		'show character y calm with fadeIn',
		'수료식이 끝났다. 우리는 웃으며 짧게 인사를 나눴다.',
		'y 같이 해서 좋았어요. 수고하셨어요!',
		'p 저도요. 덕분에 잘 마무리됐어요.',
		'hide character y with fadeOut',
		'그것으로 끝이었다.',
		'서로의 번호는 알고 있었지만, 굳이 먼저 연락할 이유는 없었다.',
		'그녀와의 1년. 좋은 팀원이었고, 함께 만든 것도 있었다.',
		'그냥, 그게 전부였다.',
		'jump EndingImageHold'
	],

	// 노멀엔딩 2 — 가끔 연락 (1 ≤ 호감도 ≤ 29)
	'ENDING_NORMAL_CONTACT': [
		'show character y calm with fadeIn',
		'수료식이 끝나고, 우리는 서로 연락처를 다시 확인했다.',
		'y 가끔 연락해요! 밥도 먹고, 커피도 마시고.',
		'p 그래. 나도 연락할게.',
		'show character y happy',
		'y 그럼 잘 지내요, {{player.name}}씨!',
		'p 응, 너도 잘 지내.',
		'hide character y with fadeOut',
		'그 후로 우리는 가끔 안부를 전했다. 명절 연락, 취업 소식, 새 프로젝트 이야기…',
		'특별하지는 않았지만, 잊지 않는 사이.',
		'그것도 충분히 소중한 인연이었다.',
		'jump EndingImageHold'
	],

	// 해피엔딩 — 30 ≤ 호감도 ≤ 99
	'ENDING_HAPPY': [
		'show character y shy with fadeIn',
		'수료식이 끝난 저녁, 광안리 바닷가.',
		'파도 소리가 두 사람 사이로 조용히 흘렀다.',
		'y 있잖아요, {{player.name}}씨…',
		'p 응?',
		'y 이거 끝나고도… 자주 볼 수 있을까요?',
		'p 물론이지. 왜, 보고 싶어?',
		'y 조금… 많이.',
		'p 하, 나도.',
		'파도 소리가 두 사람의 웃음 속에 섞였다.',
		'hide character y with fadeOut',
		'그날 이후로도 우리는 계속 만났다. 주말마다, 때로는 평일에도.',
		'사람들은 물었다. 연인이냐고.',
		'우리는 대답하지 않았다. 그냥, 이대로가 충분히 좋았으니까.',
		'jump EndingImageHold'
	],

	// 결혼 해피엔딩 — 호감도 ≥ 100
	// 흐름: 광안리 바닷가에서 대사(스프라이트 포함) → 고백 일러(클릭 대기) →
	//       검은 화면으로 페이드, 2년 후 narration → 결혼식 일러(클릭 대기) → 크레딧.
	'ENDING_MARRIAGE': [
		'show character y shy with fadeIn',
		'수료식 날 저녁, 광안리 바닷가의 노을 아래.',
		'y {{player.name}}씨, 저 드릴 말씀이 있어요.',
		'p 응? 갑자기?',
		'y 저는요… 이 1년 동안, {{player.name}}씨가 제일 좋았어요. 그 어느 것보다.',
		'p 나도야.',
		'y 그럼 앞으로도 같이 있어줄래요? 오래오래.',
		'p 같이 있는 거야? 아니면…',
		'y 같이 있는 거예요. 계속, 영원히.',
		'p 응. 같이 있자.',
		'노을이 두 사람을 물들였다. 파도 소리도, 갈매기 소리도, 세상의 모든 것이 멀어진 것 같았다.',
		'hide character y with fadeOut',
		'show scene fade_black with fadeIn',
		// 1번째 일러 — 고백 장면
		() => showEndingImage ('scene_ending_marriage_confession', ENDING_BG_FADE_MS, ENDING_BG_FADE_OUT_MS),
		function () { bgm (null); return true; },
		// 시간 경과 narration
		'그로부터 2년 뒤, 가을.',
		'그녀는 드레스를 입고 복도 끝에 서 있었다.',
		'웨딩마치가 울렸다.',
		function () { bgm ('marr'); return true; },
		// 2번째 일러 — 결혼식 장면
		() => showEndingImage ('scene_ending_marriage_wedding', ENDING_BG_FADE_MS, ENDING_BG_FADE_OUT_MS),
		'jump EndCredits'
	],

	// 엔딩 대사 종료 후 — 엔딩 이미지 표시, 클릭 한 번 대기 후 크레딧으로 진행
	'EndingImageHold': [
		'show scene fade_black with fadeIn',
		async function () {
			const game = this.storage ('game') || {};
			const bgKey = SCENE_BG_KEY[game.current_scene_id || ''];
			if (bgKey) await showEndingImage (bgKey, ENDING_BG_FADE_MS, ENDING_BG_FADE_OUT_MS);
			return true;
		},
		'jump EndCredits'
	],

	// 엔딩 크레딧 — 최종 통계 오버레이
	'EndCredits': [
		async function () {
			lockToBlack ();
			const ending = await fetchEndingContent ();
			const playerName = (this.storage ('player') || {}).name || '플레이어';
			if (ending) saveEndingClear (ending, playerName);
			await showEndCredits (ending, playerName);
			await finalizeEndingCleanup ();
			return true;
		},
		'end'
	]
});
