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
		name: '소마',
		color: '#00bfff',
		directory: 'soma',
		sprites: {
			normal: 'normal.png'
		}
	}
});

monogatari.translation ('English', {
	'보내기': '보내기'
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

let pendingLLMRequest = null;

monogatari.script ({
	'Start': [
		'show scene ASM_Entrance with fadeIn',
		'소마 1일차.',
		'p 소프트웨어 마에스트로에 합격하고 워크숍에 다녀온 이후, 처음으로 센터에 가는 날이다.',
		'p 면접 때도 봤었지만, 다시 봐도 정말 깔끔하고 멋진 곳이다.',
		'p 나는 이곳에서 어떤 팀원들과 어떤 프로젝트를 하게 될까?',
		'p 괜히 숨을 한번 고르게 된다. 기대도 되고, 조금 무섭기도 하다.',
		'센터 입구의 자동문이 열리자 밝은 조명과 낮은 대화 소리, 그리고 커피 향이 먼저 다가왔다.',
		'p 좋아. 오늘은 너무 얼지 말자.',
		'p 먼저 인사 정도는 할 수 있겠지.',
		'show character y normal at center with fadeIn',
		'그때, 안내 데스크 앞에서 명찰을 정리하던 한 사람이 고개를 들었다.',
		'p ...어?',
		'p 눈이 마주쳤다.',
		'p 그냥 처음 본 사람인데, 이상하게 한 박자 늦게 시선을 돌리게 된다.',
		'show character y normal at left with move transition 2s',
		'y 안녕하세요. 오늘 처음 오신 거죠?',
		'p 네. 오늘부터 시작이라 조금 헤매고 있었어요.',
		'y 저도요. 저는 소마예요.',
		'p 소마요?',
		'p 이름이 예쁘다. 하필 여기서 그런 생각을 먼저 하다니, 나도 참 정신없다.',
		'y 이름이 왜요?',
		'p 아, 아니요. 좋은 이름이라고 생각해서요.',
		'y 갑자기요?',
		'p 죄송합니다. 첫날이라 말이 조금 이상하게 나왔네요.',
		'y 괜찮아요. 저도 아까 출입증 찍는 곳에서 카드 대신 지갑을 대고 있었어요.',
		'p 그 말에 조금 긴장이 풀렸다.',
		'소마는 명찰을 목에 걸고, 잠깐 내 쪽을 바라봤다.',
		'y 그런데 이름이 어떻게 되세요?',
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
		'p 저는 {{player.name}}입니다.',
		'y {{player.name}}님이군요. 기억해둘게요.',
		'y 그럼... 이제부터는 대본 밖의 이야기를 해봐도 될 것 같아요.',
		'jump LLMChat'
	],

	'LLMChat': [
		{
			'Input': {
				'Text': '소마에게 어떤 말을 걸까?',
				'Type': 'textarea',
				'Class': 'llm-input',
				'Attributes': {
					'rows': '6',
					'maxlength': '500',
					'placeholder': '하고 싶은 말을 입력하세요.'
				},
				'Validation': function (input) {
					return input.trim ().length > 0;
				},
				'Save': function (input) {
					const prompt = input.trim();
					this.storage ({
						llm: {
							prompt: escapeDialogText (prompt),
							response: ''
						}
					});

					// 비동기 요청을 즉시 시작하고 Promise를 전역 변수에 저장해둡니다.
					pendingLLMRequest = fetch(LLM_PROXY_ENDPOINT, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify ({ content: prompt })
					}).then(async (response) => {
						if (!response.ok) {
							throw new Error (`LLM proxy responded with ${response.status}`);
						}
						const data = await response.json();
						this.storage ({
							llm: {
								prompt: escapeDialogText (prompt),
								response: escapeDialogText (data.response || '')
							}
						});
					}).catch((error) => {
						console.error ('LLM proxy request failed:', error);
						this.storage ({
							llm: {
								prompt: escapeDialogText (prompt),
								response: '지금은 연결이 좀 불안정한 것 같아. 잠시 후에 다시 말을 걸어줄래?'
							}
						});
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
				'actionString': '보내기'
			}
		},
		'p {{llm.prompt}}',
		'소마가 잠시 생각에 잠긴다...',
		async function () {
			if (pendingLLMRequest) {
				await pendingLLMRequest;
				pendingLLMRequest = null;
			}
			return true;
		},
		'y {{llm.response}}',
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
