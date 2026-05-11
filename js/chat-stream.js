import {
	updateSeraSprite,
	hideThinkingDots,
	flashAffinityVignette,
	updateHUD,
	showEventToast
} from './ui.js';
import { escapeDialogText } from './constants.js';

const FALLBACK_MSG = '지금은 연결이 좀 불안정한 것 같아요. 잠시 후에 다시 말을 걸어주실래요?';
const PAGE_BREAK_THRESHOLD = 80;

function handleSseEvent (event, payload, stream) {
	switch (String (event || '').toLowerCase ()) {
		case 'meta':
			if (payload?.emotion) updateSeraSprite (payload.emotion);
			stream.metaArrived = true;
			hideThinkingDots ();
			break;
		case 'delta':
		case 'message':
			if (typeof payload?.text === 'string')         stream.buffer += payload.text;
			else if (typeof payload?.chunk === 'string')   stream.buffer += payload.chunk;
			else if (typeof payload?.content === 'string') stream.buffer += payload.content;
			else if (typeof payload?.delta === 'string')   stream.buffer += payload.delta;
			break;
		case 'state': {
			const s = payload || {};
			stream.lastState = s;
			if (s.emotion) updateSeraSprite (s.emotion);
			flashAffinityVignette (typeof s.affinity_delta === 'number' ? s.affinity_delta : 0);
			updateHUD ({
				progress: typeof s.progress === 'number' ? s.progress : undefined,
				affinity: typeof s.affinity === 'number' ? s.affinity : undefined
			});
			break;
		}
		case 'event_trigger':
			stream.triggeredEventId = payload?.event_id || null;
			if (stream.triggeredEventId) showEventToast (stream.triggeredEventId);
			break;
		case 'scene_transition':
			stream.nextSceneId = payload?.next_scene_id || null;
			console.log ('[SSE scene_transition]', JSON.stringify (payload));
			break;
		case 'error':
			if (!stream.buffer) stream.buffer = FALLBACK_MSG;
			break;
		default:
			console.warn ('[chat] 처리되지 않은 SSE 이벤트:', event, payload);
	}
}

function parseSseBlock (block, doneRef, stream) {
	let evt = 'message';
	let dataStr = '';
	for (const rawLine of block.split (/\r?\n/)) {
		if (rawLine.startsWith ('event:')) evt = rawLine.slice (6).trim ();
		else if (rawLine.startsWith ('data:')) {
			const part = rawLine.slice (5).replace (/^\s/, '');
			dataStr += (dataStr ? '\n' : '') + part;
		}
	}
	if (evt === 'end') { doneRef.done = true; return; }
	if (!dataStr) return;
	let payload;
	try { payload = JSON.parse (dataStr); }
	catch (e) { console.warn ('[chat] SSE JSON parse 실패:', dataStr.slice (0, 200)); return; }
	handleSseEvent (evt, payload, stream);
}

// SSE fetch를 소비하기 시작한다. 반환된 stream 객체의 buffer/done 필드가 실시간으로 갱신된다.
export function startSseStream (pendingFetch) {
	const stream = {
		buffer:           '',
		done:             false,
		metaArrived:      false,
		nextSceneId:      null,
		triggeredEventId: null,
		lastState:        null
	};

	(async () => {
		try {
			const response = await pendingFetch;
			if (!response.ok) throw new Error (`HTTP ${response.status}`);
			const reader  = response.body.getReader ();
			const decoder = new TextDecoder ();
			let buf = '';
			const doneRef = { done: false };
			while (!doneRef.done) {
				const { done: d, value } = await reader.read ();
				if (d) break;
				buf += decoder.decode (value, { stream: true });
				const blocks = buf.split (/\r?\n\r?\n/);
				buf = blocks.pop () || '';
				for (const block of blocks) {
					if (!block.trim ()) continue;
					parseSseBlock (block, doneRef, stream);
					if (doneRef.done) break;
				}
			}
			buf += decoder.decode ();
			if (buf.trim ()) {
				for (const block of buf.split (/\r?\n\r?\n/)) {
					if (block.trim ()) parseSseBlock (block, doneRef, stream);
				}
			}
		} catch (e) {
			console.error ('[chat] stream error:', e);
			if (!stream.buffer) stream.buffer = FALLBACK_MSG;
		}
		stream.done = true;
	}) ();

	return stream;
}

// stream.buffer를 페이지 브레이크 포함하여 sayEl에 타이핑한다.
export async function playChatTypewriter (sayEl, stream) {
	let typed          = 0;
	let pageText       = '';
	let skipToBreak    = false;
	let pageState      = 'typing';
	let resolveAdvance = null;

	const handleInteract = (e) => {
		if (e.type === 'keydown') {
			if (e.isComposing || e.keyCode === 229) return;
			if (!['Enter', ' ', 'ArrowRight'].includes (e.key)) return;
		}
		if (e.type === 'click' && e.target?.closest?.('text-input, button, select, input, textarea, .llm-suggestions')) return;
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
		sayEl.classList.add ('say--awaiting');
		return new Promise (r => { resolveAdvance = r; });
	};
	const finishWait     = () => { sayEl.classList.remove ('say--awaiting'); };
	const skipWhitespace = () => {
		while (typed < stream.buffer.length && ' \n\r\t'.includes (stream.buffer[typed])) typed++;
	};

	while (typed >= stream.buffer.length && !stream.done) {
		await new Promise (r => setTimeout (r, 10));
	}
	skipWhitespace ();

	while (true) {
		if (typed >= stream.buffer.length) {
			if (stream.done) break;
			await new Promise (r => setTimeout (r, 10));
			continue;
		}

		const ch = stream.buffer[typed++];
		pageText += ch;
		sayEl.innerHTML = escapeDialogText (pageText);

		let dwell = 0;
		if      (/[.!?。！？]/.test (ch)) dwell = 70;
		else if (ch === '…' || ch === '⋯') dwell = 180;
		else if (/[,、]/.test (ch))        dwell = 35;

		if (/[.!?。！？]/.test (ch) && pageText.length >= PAGE_BREAK_THRESHOLD) {
			if (typed >= stream.buffer.length && !stream.done) {
				await new Promise (r => setTimeout (r, 50));
			}
			const next = stream.buffer[typed];
			if (!next || next === ' ' || next === '\n') {
				await waitForAdvance ();
				finishWait ();
				skipToBreak = false;
				pageState   = 'typing';
				pageText    = '';
				sayEl.innerHTML = '';
				skipWhitespace ();
			}
		}

		if (!skipToBreak) {
			await new Promise (r => setTimeout (r, 30 + dwell));
		}
	}

	if (pageText.trim ()) {
		await waitForAdvance ();
		finishWait ();
	}

	document.removeEventListener ('click', handleInteract);
	document.removeEventListener ('keydown', handleInteract);
}
