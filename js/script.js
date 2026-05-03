/* global monogatari */

// 게임에서 사용할 메시지 정의
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

// 게임에서 사용할 알림 정의
monogatari.action ('notification').notifications ({
	'Welcome': {
		title: 'Welcome',
		body: 'This is the Monogatari VN Engine',
		icon: ''
	}
});

// 게임에서 사용할 Particles JS 구성 정의
monogatari.action ('particles').particles ({

});

// 게임에서 사용할 캔버스 오브젝트 정의
monogatari.action ('canvas').objects ({

});

// 게임 시작 전 크레딧 정의
monogatari.configuration ('credits', {

});

// 게임 이미지 갤러리 정의
monogatari.assets ('gallery', {

});

// 게임 음악 정의
monogatari.assets ('music', {

});

// 게임 음성 파일 정의
monogatari.assets ('voices', {

});

// 게임 효과음 정의
monogatari.assets ('sounds', {

});

// 게임 비디오 정의
monogatari.assets ('videos', {

});

// 게임 이미지 정의
monogatari.assets ('images', {

});

// 배경 이미지 정의
monogatari.assets ('scenes', {
	'ASM_Entrance': 'entrance.png'
});

// 등장인물 정의
monogatari.characters ({
	'p': {
		name: '{{player.name}}',
		color: '#8ad8ff'
	},
	'y': {
		name: '{{sera.name}}',
		color: '#00bfff',
		directory: 'soma',
		sprites: {
			normal: 'normal.png'
		}
	}
});


monogatari.translation ('English', {
	'보내기': '보내기',
	'↑': '↑'
});

const LLM_PROXY_ENDPOINT = 'http://127.0.0.1:8000/generate';

function escapeDialogText (text) {
	return String (text)
		.replace (/&/g, '&amp;')
		.replace (/</g, '&lt;')
		.replace (/>/g, '&gt;')
		.replace (/"/g, '&quot;')
		.replace (/'/g, '&#039;')
		.replace (/\r?\n/g, '<br>');
}

let pendingStreamResponse = null; // Promise<Response> — Save에서 즉시 시작하는 fetch

monogatari.script ({
	'Start': [
		{
			'Input': {
				'Text': '이름을 입력하세요.',
				'Validation': function (input) {
					return input.trim ().length > 0;
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
				'Warning': '이름을 입력해야 합니다.'
			}
		},
		'4월 13일, 월요일. 화창한 아침.',
		'또로로롱~ 오니쨩~! 일어날 시간이에요!!',
		'또로로롱~ 오니쨩~! 일어날 시간이에요!!',
		'…뚝.',
		'p 으… 아침인가… 벌써 시간이…',
		'p 일어나서 씻어야지…',
		'저벅… 저벅… 샤아아아아—',
		'…툭. 위이이이잉… 딸깍. 툭.',
		'p 하아… 이제야 좀 상쾌하네. 오늘은 처음 센터에 가는 날이니까 빨리 준비해야지.',
		'철컥— 쿠구구궁… 덜컹… 덜컹…',
		'p 탈 때마다 왜 이리 시끄럽지…',
		'끼이이익… 덜컹… 슈우우우욱.',
		'show scene ASM_Entrance with fadeIn',
		'저벅… 저벅…',
		'p 오, 여기가 소마 건물이구나. 7층이었지, 아마?',
		'띵— 문이 열린다.',
		'p 오오! 이곳이 센터구나. 안이 생각보다 훨씬 깔끔한걸?',
		'소프트웨어 마에스트로에 운 좋게 합격한 나는, 워크숍이 끝나고 처음으로 센터에 발을 들였다.',
		'p 센터 오픈 첫날이라 그런지 사람이 꽤 많네. 워크숍 때는 제대로 얘기를 못해봤지만… 오늘은 꼭 팀원을 구해야지!',
		'p 워크숍 때 봤던 그 사람도 있을까…?',
		'지난주 워크숍에서 간식을 너무 많이 먹은 탓에 혈당 스파이크가 왔고, 결국 중간에 골아 떨어지는 바람에 네트워킹을 제대로 못했다.',
		'p 앞으로 간식은 자제하자…',
		'안쪽으로 발걸음을 옮긴다.',
		'p 이야, 벌써 서로 안면을 텄구나. 나도 워크숍 때 좀 잘할걸 그랬네…',
		'p 아니야, 지금도 늦지 않았어. 열심히 네트워킹하자!',
		'— S1 룸 —',
		'p 아, 여기가 그곳이구나! 내가 면접 봤던 곳… 그땐 좁아 보였는데, 벽을 치우니까 엄청 넓네.',
		'저벅… 저벅… 툭.',
		'p 어?',
		'show character y normal with fadeIn',
		'창가로 햇볕이 조용히 내리쬐는 자리. 그 빛 속에 한 사람이 앉아 있었다.',
		'흰 머리카락이 햇살에 부드럽게 빛나고, 파란 눈이 조용히 어딘가를 응시하고 있다. 보고 있으면 자꾸 시선이 머무는 사람이었다.',
		'p 저 사람은… 워크숍 때 봤던 사람이잖아? 다시 봐도 정말 눈에 띄는 사람이네.',
		'p 그때 잠깐 이야기 듣다 보니 관심사가 나랑 비슷한 것 같았어. 지금이라도 말을 걸어봐야겠다.',
		'그녀 앞으로 조심스럽게 다가간다.',
		'p 저… 저기요!',
		'y …?',
		'p 혹시… 저 기억하시나요?',
		'y 응? 아니요? 누구세요?',
		'그녀가 잠시 나를 바라보더니, 뭔가 떠오른 듯 눈이 살짝 커졌다.',
		'y 아…! 그때 워크숍 18번 테이블에서 초코파이 드시던 분이세요?',
		'p 네…! 기억해주셨군요. 저 {{player.name}}이에요.',
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
		'y 오, 그분이셨구나. 안녕하세요. 저는 이세라예요.',
		'y 잘 부탁드려요, {{player.name}}씨.',
		'p 반갑습니다…!',
		'p 어색한 첫 인사는 끝났다. 이제 뭐라고 말을 꺼내지…',
		'jump LLMChat'
	],

	'LLMChat': [
		{
			'Input': {
				'Text': '',
				'Type': 'textarea',
				'Class': 'llm-input',
				'Attributes': {
					'rows': '1',
					'maxlength': '300',
					'placeholder': '하고 싶은 말을 입력하세요...'
				},
				'Validation': function (input) {
					return input.trim ().length > 0;
				},
				'Save': function (input) {
					const prompt = input.trim ();
					this.storage ({
						llm: {
							prompt: escapeDialogText (prompt),
							response: ''
						}
					});

					// 즉시 fetch 시작 — Promise<Response> 저장 (헤더 도달 시 resolve)
					pendingStreamResponse = fetch (LLM_PROXY_ENDPOINT, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify ({ content: prompt })
					});

					return true;
				},
				'Revert': function () {
					this.storage ({
						llm: {
							prompt: '',
							response: ''
						}
					});
				},
				'Warning': '한 글자 이상 입력해야 해요.',
				'actionString': '↑'
			}
		},
		'p {{llm.prompt}}',
		async function () {
			const sayEl = document.querySelector ('[data-ui="say"]');
			const whoEl = document.querySelector ('[data-ui="who"]');
			if (whoEl) whoEl.textContent = '이세라';
			if (sayEl) sayEl.innerHTML = '';

			// [Producer] 스트림 읽기를 백그라운드에서 실행
			let textBuffer = '';
			let streamComplete = false;

			try {
				const response = await pendingStreamResponse;
				pendingStreamResponse = null;
				if (!response.ok) throw new Error (`HTTP ${response.status}`);

				const reader = response.body.getReader ();
				const decoder = new TextDecoder ();

				(async () => {
					try {
						let buf = '';
						let done = false;
						while (!done) {
							const { done: d, value } = await reader.read ();
							if (d) break;
							buf += decoder.decode (value, { stream: true });
							const sseLines = buf.split ('\n');
							buf = sseLines.pop () || '';
							for (const line of sseLines) {
								if (!line.startsWith ('data: ')) continue;
								const payload = line.slice (6).trim ();
								if (payload === '[DONE]') { done = true; break; }
								try {
									const data = JSON.parse (payload);
									if (data.error) throw new Error (data.error);
									textBuffer += data.chunk || '';
								} catch (_) {}
							}
						}
					} catch (e) {
						console.error ('Stream read error:', e);
					}
					streamComplete = true;
				}) ();
			} catch (error) {
				console.error ('Fetch failed:', error);
				textBuffer = '지금은 연결이 좀 불안정한 것 같아요. 잠시 후에 다시 말을 걸어주실래요?';
				streamComplete = true;
			}

			// [Consumer] 타이프라이터 + 페이지 구분
			const PAGE_BREAK_THRESHOLD = 80;
			let typed = 0;
			let pageText = '';
			let skipToBreak = false;

			// 상태 머신: 'typing' → 클릭 시 스킵, 'waiting' → 클릭 시 다음 페이지 진행
			let pageState = 'typing';
			let resolveAdvance = null;

			const handleInteract = (e) => {
				if (e.type === 'keydown' && !['Enter', ' ', 'ArrowRight'].includes (e.key)) return;
				if (e.type === 'click' && e.target?.closest?.('text-input, button, select, input, textarea')) return;
				if (e.type === 'keydown') e.preventDefault ();
				if (pageState === 'typing') {
					skipToBreak = true;
				} else if (pageState === 'waiting' && resolveAdvance) {
					resolveAdvance ();
					resolveAdvance = null;
				}
			};
			document.addEventListener ('click', handleInteract);
			document.addEventListener ('keydown', handleInteract);

			const waitForAdvance = () => {
				pageState = 'waiting';
				return new Promise (r => { resolveAdvance = r; });
			};

			// 페이지 시작 시 선행 공백·줄바꿈 스킵 (빈 줄이 먼저 출력되는 것 방지)
			const skipLeadingWhitespace = () => {
				while (typed < textBuffer.length && ' \n\r\t'.includes (textBuffer[typed])) {
					typed++;
				}
			};

			// 첫 데이터가 도착할 때까지 대기 후 선행 공백 스킵
			while (typed >= textBuffer.length && !streamComplete) {
				await new Promise (r => setTimeout (r, 10));
			}
			skipLeadingWhitespace ();

			while (true) {
				if (typed >= textBuffer.length) {
					if (streamComplete) break;
					await new Promise (r => setTimeout (r, 10));
					continue;
				}

				const ch = textBuffer[typed++];
				pageText += ch;
				sayEl.innerHTML = escapeDialogText (pageText);

				if (/[.!?。！？]/.test (ch) && pageText.length >= PAGE_BREAK_THRESHOLD) {
					if (typed >= textBuffer.length && !streamComplete) {
						await new Promise (r => setTimeout (r, 50));
					}
					const next = textBuffer[typed];
					if (!next || next === ' ' || next === '\n') {
						await waitForAdvance ();
						skipToBreak = false;
						pageState = 'typing';
						pageText = '';
						sayEl.innerHTML = '';
						skipLeadingWhitespace (); // 다음 페이지 선행 공백 스킵
					}
				}

				if (!skipToBreak) {
					await new Promise (r => setTimeout (r, 30));
				}
			}

			if (pageText.trim ()) {
				await waitForAdvance ();
			}

			document.removeEventListener ('click', handleInteract);
			document.removeEventListener ('keydown', handleInteract);

			this.storage ({
				llm: {
					prompt: this.storage ('llm').prompt,
					response: textBuffer
				}
			});

			return true;
		},
		{
			'Choice': {
				'Dialog': 'y 더 이야기할까요?',
				'Talk': {
					'Text': '계속 대화한다',
					'Do': 'jump LLMChat'
				},
				'End': {
					'Text': '오늘은 여기까지',
					'Do': 'jump LLMEnd'
				}
			}
		}
	],

	'LLMEnd': [
		'y 좋아요. 다음에 또 이야기해요, {{player.name}}씨.',
		'end'
	]
});

// 전역 이벤트 리스너 추가: 엔터키 전송
document.addEventListener('keydown', function (e) {
	// Shift를 누르지 않은 그냥 Enter 일 때만 전송
	if (e.target.matches('.llm-input textarea') && e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		const form = e.target.closest('text-input');
		if (form) {
			const btn = form.querySelector('button');
			if (btn) btn.click();
		}
	}
});
