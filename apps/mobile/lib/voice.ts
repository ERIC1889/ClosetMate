import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

// expo-audio (SDK 56) 의 useAudioRecorder / useAudioRecorderState 를 감싸 토글식 인터페이스로 제공한다.
// - idle ↔ recording 토글 (한 번 누르면 녹음 시작, 다시 누르면 종료 후 uri 반환)
// - transcribing 은 호출부가 STT API 호출 중에 setTranscribing(true) 로 표시할 수 있도록 외부에 노출
// - 'unsupported' 는 마이크 권한 거부나 native module 부재(Expo Go 일부 환경) 시 fallback

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'unsupported';

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const audioModeReady = useRef(false);

  // 첫 녹음 시 한 번만 권한 요청 + iOS 녹음용 오디오 세션 모드 설정
  const ensureReady = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setState('unsupported');
      setError('마이크 권한이 필요해요');
      return false;
    }
    if (!audioModeReady.current) {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      audioModeReady.current = true;
    }
    return true;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const ok = await ensureReady();
      if (!ok) return;
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('recording');
    } catch (err) {
      console.warn('[voice] start failed', err);
      setError(err instanceof Error ? err.message : '녹음 시작 실패');
      setState('idle');
    }
  }, [recorder, ensureReady]);

  const stop = useCallback(async (): Promise<string | null> => {
    try {
      await recorder.stop();
      setState('idle');
      return recorder.uri ?? null;
    } catch (err) {
      console.warn('[voice] stop failed', err);
      setError(err instanceof Error ? err.message : '녹음 종료 실패');
      setState('idle');
      return null;
    }
  }, [recorder]);

  // 한 번 누르면 시작, 다시 누르면 종료. 종료 시에는 녹음된 파일 uri 반환.
  const toggle = useCallback(async (): Promise<string | null> => {
    if (state === 'recording') return stop();
    await start();
    return null;
  }, [state, start, stop]);

  const setTranscribing = useCallback((on: boolean) => {
    setState((prev) => {
      if (on) return 'transcribing';
      if (prev === 'transcribing') return 'idle';
      return prev;
    });
  }, []);

  // 마운트 해제 시 녹음이 남아있다면 정리
  useEffect(() => {
    return () => {
      if (recorderState.isRecording) {
        recorder.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    error,
    durationMillis: recorderState.durationMillis,
    start,
    stop,
    toggle,
    setTranscribing,
  };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
