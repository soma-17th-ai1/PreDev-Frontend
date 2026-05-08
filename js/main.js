'use strict';
/* global Monogatari */
/* global monogatari */

/**
 * =============================================================================
 * 이 파일은 모든 커스텀 JavaScript 코드를 넣는 곳입니다.
 * 수행하려는 작업에 따라 이 파일에는 코드를 추가할 수 있는
 * 서로 다른 세 위치가 있습니다.
 *
 * 1. `$_ready` 함수 밖: 이 시점에서는 페이지가 완전히 로드되지 않았을 수 있지만,
 *    Monogatari에 새 액션, 컴포넌트, 레이블, 캐릭터 등을 등록할 수 있습니다.
 *
 * 2. `$_ready` 함수 내부: 이 시점에서는 페이지가 로드되어 HTML 요소와
 *    상호작용할 수 있습니다.
 *
 * 3. `init` 함수 내부: 이 시점에서는 Monogatari가 초기화되어 내부 동작의
 *    이벤트 리스너가 등록되고, (설정되어 있으면) 자산이 프리로드되어
 *    게임을 실행할 준비가 되어 있습니다.
 *
 * 항상 `$_ready` 함수를 이 파일의 가장 마지막에 두세요.
 * =============================================================================
 **/

const { $_ready, $_ } = Monogatari;

// 1. Outside the $_ready function:
// SomaMainMenu (custom main-menu component) is defined and registered in script.js,
// alongside the helpers it depends on (fetchSessionMe / loadFromSlot / _confirmReset etc.).

if (window.location.protocol !== 'file:') {
	const manifestLink = document.createElement ('link');
	manifestLink.rel = 'manifest';
	manifestLink.href = 'manifest.json';
	document.head.appendChild (manifestLink);
}

$_ready (() => {
	// 2. Inside the $_ready function:

	monogatari.init ('#monogatari').then (() => {
		// 3. Inside the init function:

	});
});
