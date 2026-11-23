import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/context/I18nContext';
import { deleteAudioFile } from '../../src/services/voiceLogbook/deleteAudioFile';
import {
  addVoiceNote,
  formatDurationMs,
  listVoiceNotes,
  removeVoiceNote,
  type VoiceLogNote,
} from '../../src/services/voiceLogbook/voiceLogbookStorage';
import {
  shareVoiceNoteFile,
  shareVoiceNoteToFeed,
} from '../../src/services/voiceLogbook/shareVoiceNote';
import { colors } from '../../src/theme/colors';

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Post-trip voice logbook — record (expo-audio), local store, playback, share with truckers. */
export default function CarnetVocalScreen() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{
    label?: string | string[];
    lat?: string | string[];
    lon?: string | string[];
    mode?: string | string[];
  }>();

  const tripLabel = firstParam(params.label);
  const tripLat = Number.parseFloat(firstParam(params.lat) ?? '');
  const tripLon = Number.parseFloat(firstParam(params.lon) ?? '');
  const rawMode = firstParam(params.mode);
  const vehicleMode =
    rawMode === 'camion' || rawMode === 'voiture' ? rawMode : undefined;

  const [notes, setNotes] = useState<VoiceLogNote[]>([]);
  const [titleDraft, setTitleDraft] = useState(
    tripLabel ? `Arrivée — ${tripLabel}` : 'Note vocale trajet',
  );
  const [phase, setPhase] = useState<'idle' | 'recording' | 'saving'>('idle');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const playUriRef = useRef<string | null>(null);

  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    // Persist beyond cache eviction (expo-audio v58 directory option).
    directory: 'document',
  });
  const recorderState = useAudioRecorderState(audioRecorder, 200);

  // Stable player instance — switch sources with replace(), never recreate via hook source.
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  const reload = useCallback(async () => {
    setNotes(await listVoiceNotes());
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  // Stop mic + restore audio mode if the user leaves mid-recording.
  useEffect(() => {
    return () => {
      void (async () => {
        try {
          const st = audioRecorder.getStatus();
          if (st.isRecording) await audioRecorder.stop();
        } catch {
          /* unmounted */
        }
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: false,
          });
        } catch {
          /* ignore */
        }
      })();
    };
  }, [audioRecorder]);

  const startRecording = () => {
    if (busyRef.current || phase === 'recording') return;
    busyRef.current = true;
    setPhase('recording');
    setStatusMsg(null);
    void (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setStatusMsg(t('voiceLogbook.micDenied'));
          setPhase('idle');
          return;
        }
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      } catch (e) {
        setStatusMsg(
          e instanceof Error ? e.message : t('voiceLogbook.recordFail'),
        );
        setPhase('idle');
      } finally {
        busyRef.current = false;
      }
    })();
  };

  const stopAndSave = () => {
    if (phase !== 'recording' || busyRef.current) return;
    busyRef.current = true;
    setPhase('saving');
    void (async () => {
      try {
        await audioRecorder.stop();
        const status = audioRecorder.getStatus();
        const uri = audioRecorder.uri ?? status.url;
        if (!uri) {
          setStatusMsg(t('voiceLogbook.noFile'));
          setPhase('idle');
          return;
        }
        const durationMs = status.durationMillis ?? 0;
        if (durationMs < 400) {
          await deleteAudioFile(uri);
          setStatusMsg(t('voiceLogbook.tooShort'));
          setPhase('idle');
          return;
        }
        await addVoiceNote({
          uri,
          durationMs,
          title: titleDraft.trim() || t('voiceLogbook.defaultTitle'),
          tripLabel: tripLabel || undefined,
          tripLat: Number.isFinite(tripLat) ? tripLat : undefined,
          tripLon: Number.isFinite(tripLon) ? tripLon : undefined,
          vehicleMode,
        });
        setStatusMsg(t('voiceLogbook.saved'));
        await reload();
      } catch (e) {
        setStatusMsg(
          e instanceof Error ? e.message : t('voiceLogbook.recordFail'),
        );
      } finally {
        busyRef.current = false;
        setPhase('idle');
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: false,
          });
        } catch {
          /* ignore */
        }
      }
    })();
  };

  const playNote = (note: VoiceLogNote) => {
    if (playingId === note.id && playerStatus.playing) {
      player.pause();
      return;
    }
    try {
      if (playUriRef.current === note.uri) {
        if (playerStatus.didJustFinish || playerStatus.currentTime > 0) {
          player.seekTo(0);
        }
        player.play();
        setPlayingId(note.id);
        return;
      }
      playUriRef.current = note.uri;
      setPlayingId(note.id);
      player.replace({ uri: note.uri });
      player.play();
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : t('voiceLogbook.playFail'));
      setPlayingId(null);
    }
  };

  const onShareFile = (note: VoiceLogNote) => {
    void shareVoiceNoteFile(note).then((r) => setStatusMsg(r.message));
  };

  const onShareFeed = (note: VoiceLogNote) => {
    void shareVoiceNoteToFeed(
      note,
      profile?.displayName?.trim() ||
        (profile?.uid ? `Conducteur-${profile.uid.slice(0, 6)}` : undefined),
    ).then(async (r) => {
      setStatusMsg(r.message);
      await reload();
    });
  };

  const onDelete = (note: VoiceLogNote) => {
    void (async () => {
      if (playingId === note.id) {
        try {
          player.pause();
        } catch {
          /* ignore */
        }
        setPlayingId(null);
        if (playUriRef.current === note.uri) playUriRef.current = null;
      }
      await removeVoiceNote(note.id);
      setStatusMsg(t('voiceLogbook.deleted'));
      await reload();
    })();
  };

  const recordingMs = recorderState.durationMillis ?? 0;
  const isPlaying = (id: string) =>
    playingId === id && playerStatus.playing && !playerStatus.didJustFinish;

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.carnetVocal') }} />
      <Screen
        variant="stack"
        title={t('moduleTitles.carnetVocal')}
        subtitle={t('moduleTitles.carnetVocalSub')}
      >
        <StubBanner text={t('voiceLogbook.stub')} />

        {tripLabel || Number.isFinite(tripLat) ? (
          <Card title={t('voiceLogbook.tripContext')}>
            <Text style={styles.meta}>
              {tripLabel ?? '—'}
              {Number.isFinite(tripLat) && Number.isFinite(tripLon)
                ? `\n${tripLat.toFixed(5)}, ${tripLon.toFixed(5)}`
                : ''}
              {vehicleMode ? `\n${vehicleMode}` : ''}
            </Text>
          </Card>
        ) : null}

        <Card title={t('voiceLogbook.recordTitle')}>
          <Text style={styles.hint}>{t('voiceLogbook.recordHint')}</Text>
          <TextInput
            style={styles.input}
            value={titleDraft}
            onChangeText={setTitleDraft}
            placeholder={t('voiceLogbook.titlePlaceholder')}
            placeholderTextColor={colors.muted}
          />
          <View style={styles.row}>
            {phase === 'recording' ? (
              <Pressable style={styles.btnDanger} onPress={stopAndSave}>
                <Text style={styles.btnTxt}>
                  {t('voiceLogbook.stopSave')} · {formatDurationMs(recordingMs)}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.btn}
                onPress={startRecording}
                disabled={phase === 'saving'}
              >
                <Text style={styles.btnTxt}>
                  {phase === 'saving'
                    ? t('voiceLogbook.saving')
                    : t('voiceLogbook.start')}
                </Text>
              </Pressable>
            )}
          </View>
        </Card>

        <Card title={t('voiceLogbook.listTitle')}>
          {notes.length === 0 ? (
            <Text style={styles.meta}>{t('voiceLogbook.empty')}</Text>
          ) : (
            notes.map((n) => (
              <View key={n.id} style={styles.noteCard}>
                <Text style={styles.noteTitle}>{n.title}</Text>
                <Text style={styles.meta}>
                  {new Date(n.createdAt).toLocaleString()} ·{' '}
                  {formatDurationMs(n.durationMs)}
                  {n.tripLabel ? ` · ${n.tripLabel}` : ''}
                  {n.sharedToFeedAt ? ` · ${t('voiceLogbook.sharedBadge')}` : ''}
                </Text>
                <View style={styles.row}>
                  <Pressable style={styles.chip} onPress={() => playNote(n)}>
                    <Text style={styles.chipTxt}>
                      {isPlaying(n.id)
                        ? t('voiceLogbook.pause')
                        : t('voiceLogbook.play')}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.chip} onPress={() => onShareFile(n)}>
                    <Text style={styles.chipTxt}>{t('voiceLogbook.shareOs')}</Text>
                  </Pressable>
                  <Pressable style={styles.chipGreen} onPress={() => onShareFeed(n)}>
                    <Text style={styles.chipTxt}>{t('voiceLogbook.shareFeed')}</Text>
                  </Pressable>
                  <Pressable style={styles.chipDark} onPress={() => onDelete(n)}>
                    <Text style={styles.chipTxtOnDark}>{t('voiceLogbook.delete')}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </Card>

        {statusMsg ? <Text style={styles.status}>{statusMsg}</Text> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.slate, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    backgroundColor: colors.white,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btnDanger: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
  noteCard: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    marginTop: 8,
    gap: 6,
  },
  noteTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  chip: {
    backgroundColor: colors.signalSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chipGreen: {
    backgroundColor: colors.garageSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chipDark: {
    backgroundColor: colors.asphalt,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  chipTxt: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  chipTxtOnDark: { color: colors.white, fontWeight: '700', fontSize: 12 },
  status: {
    marginTop: 8,
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
  },
});
