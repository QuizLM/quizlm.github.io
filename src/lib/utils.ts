// import { state } from './state.js'; // State will be passed or accessed via Context
// import { dom } from './dom.js'; // DOM will be accessed via React Refs or directly

declare const Swal: any;
declare const marked: any;

export const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast: any) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

export function playSound(soundId: string, isMuted: boolean) {
    const soundElement = document.getElementById(soundId) as HTMLAudioElement;
    if (!isMuted && soundElement && soundElement.play) {
        soundElement.currentTime = 0;
        soundElement.play().catch(e => console.warn(`Audio play error for ${soundId}:`, e));
    }
}

export function triggerHapticFeedback(type: 'correct' | 'wrong', isHapticEnabled: boolean) {
    if (isHapticEnabled && 'vibrate' in navigator) {
        if (type === 'correct') {
            navigator.vibrate(50); // Short buzz for correct
        } else if (type === 'wrong') {
            navigator.vibrate([50, 50, 50]); // Double buzz for wrong
        }
    }
}

export function shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function buildExplanationHtml(explanationObject: any) {
    if (!explanationObject || typeof explanationObject !== 'object') {
        return '';
    }
    let html = '';
    const sectionOrder = ['summary', 'analysis_correct', 'analysis_incorrect', 'conclusion', 'fact'];

    sectionOrder.forEach(key => {
        if (explanationObject[key]) {
            html += `<div class="explanation-section explanation-${key}">`;
            html += marked.parse(explanationObject[key]);
            html += `</div>`;
        }
    });
    return html;
}

export function debounce(func: Function, delay: number) {
    let timeoutId: any;
    return function(this: any, ...args: any[]) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}
