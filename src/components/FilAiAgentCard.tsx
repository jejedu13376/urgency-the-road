import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from './Card';
import { useFleet } from '../context/FleetContext';
import { useI18n } from '../context/I18nContext';
import {
  askFilAiAgent,
  FIL_AI_SUBJECTS,
  type FilAiChatTurn,
  type FilAiSubject,
} from '../services/ai/filAiAgent';
import { speakViaExpo, speechStop } from '../services/urgence/speechBridge';
import { colors } from '../theme/colors';

type Bubble = FilAiChatTurn & { id: string; at: string };

const SUBJECT_I18N: Record<FilAiSubject, string> = {
  car: 'fil.aiSubjectCar',
  truck: 'fil.aiSubjectTruck',
  parts: 'fil.aiSubjectParts',
  diagnostic: 'fil.aiSubjectDiagnostic',
  truckers: 'fil.aiSubjectTruckers',
};

/**
 * Live AI agent section for the Fil (chatbubbles) tab.
 * Dyslexia-friendly: large type, high line-height, strong contrast, big tap targets.
 */
export function FilAiAgentCard() {
  const { t, locale } = useI18n();
  const { active } = useFleet();
  const [subject, setSubject] = useState<FilAiSubject>('diagnostic');
  const [draft, setDraft] = useState('');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [needVerify, setNeedVerify] = useState(false);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft('');
    const now = new Date().toISOString();
    const userBubble: Bubble = {
      id: `u-${now}`,
      role: 'user',
      text,
      at: now,
    };
    setBubbles((prev) => [...prev, userBubble]);

    try {
      const history: FilAiChatTurn[] = [...bubbles, userBubble].map((b) => ({
        role: b.role,
        text: b.text,
      }));
      const res = await askFilAiAgent({
        message: text,
        subject,
        vehicle: active,
        history,
        locale,
      });
      setNeedVerify(Boolean(res.emailVerificationRequired));
      setStatus(res.label);
      const assistant: Bubble = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        at: new Date().toISOString(),
      };
      setBubbles((prev) => [...prev, assistant]);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : t('fil.aiError');
      setBubbles((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: msg,
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [active, bubbles, busy, draft, locale, subject, t]);

  const speakLast = async () => {
    const last = [...bubbles].reverse().find((b) => b.role === 'assistant');
    if (!last) return;
    setSpeaking(true);
    const lang = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'fr-FR';
    // Slightly slower rate helps dyslexic listeners follow.
    await speakViaExpo(lang, last.text.slice(0, 400), { rate: 0.88 });
    setSpeaking(false);
  };

  const stopVoice = () => {
    void speechStop();
    setSpeaking(false);
  };

  const clearChat = () => {
    setBubbles([]);
    setStatus(null);
    setNeedVerify(false);
  };

  return (
    <Card title={t('fil.aiTitle')}>
      <Text style={styles.lead}>{t('fil.aiLead')}</Text>

      <Text style={styles.label}>{t('fil.aiSubjectLabel')}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {FIL_AI_SUBJECTS.map((s) => {
          const on = subject === s;
          return (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(SUBJECT_I18N[s])}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setSubject(s)}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>
                {t(SUBJECT_I18N[s])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.ctxBox}>
        <Text style={styles.ctxTxt}>
          {active
            ? t('fil.aiVehicleOn', {
                label: `${active.make} ${active.model} ${active.year}`,
              })
            : t('fil.aiVehicleOff')}
        </Text>
      </View>

      {needVerify ? (
        <Text style={styles.warn}>{t('fil.aiNeedVerify')}</Text>
      ) : null}

      <ScrollView
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {bubbles.length === 0 ? (
          <Text style={styles.placeholder}>{t('fil.aiPlaceholder')}</Text>
        ) : (
          bubbles.map((b) => (
            <View
              key={b.id}
              style={[
                styles.bubble,
                b.role === 'user' ? styles.bubbleUser : styles.bubbleAi,
              ]}
            >
              <Text style={styles.bubbleRole}>
                {b.role === 'user' ? t('fil.aiYou') : t('fil.aiAgent')}
              </Text>
              <Text style={styles.bubbleTxt}>{b.text}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <TextInput
        value={draft}
        onChangeText={setDraft}
        style={styles.input}
        placeholder={t('fil.aiInputPh')}
        placeholderTextColor={colors.muted}
        multiline
        accessibilityLabel={t('fil.aiInputPh')}
        editable={!busy}
      />

      <Pressable
        style={[styles.send, busy && styles.sendDisabled]}
        onPress={() => void send()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t('fil.aiSend')}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.sendTxt}>{t('fil.aiSend')}</Text>
        )}
      </Pressable>

      <View style={styles.row}>
        <Pressable
          style={styles.secondary}
          onPress={() => void speakLast()}
          accessibilityRole="button"
          accessibilityLabel={t('fil.aiSpeak')}
        >
          <Text style={styles.secondaryTxt}>
            {speaking ? t('fil.aiSpeaking') : t('fil.aiSpeak')}
          </Text>
        </Pressable>
        <Pressable
          style={styles.stop}
          onPress={stopVoice}
          accessibilityRole="button"
          accessibilityLabel={t('fil.aiStopVoice')}
        >
          <Text style={styles.sendTxt}>{t('fil.aiStopVoice')}</Text>
        </Pressable>
      </View>

      {bubbles.length > 0 ? (
        <Pressable
          style={styles.clear}
          onPress={clearChat}
          accessibilityRole="button"
          accessibilityLabel={t('fil.aiClear')}
        >
          <Text style={styles.clearTxt}>{t('fil.aiClear')}</Text>
        </Pressable>
      ) : null}

      {status ? <Text style={styles.meta}>{status}</Text> : null}
    </Card>
  );
}

/** Dyslexia-friendly tokens: larger type, open spacing, high contrast. */
const styles = StyleSheet.create({
  lead: {
    color: colors.slate,
    fontSize: 17,
    lineHeight: 28,
    letterSpacing: 0.35,
    fontWeight: '500',
    marginBottom: 10,
  },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: colors.paper,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.line,
    minHeight: 48,
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: colors.asphalt,
    borderColor: colors.asphalt,
  },
  chipTxt: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  chipTxtOn: {
    color: colors.white,
  },
  ctxBox: {
    backgroundColor: colors.garageSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.garage,
  },
  ctxTxt: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.25,
    fontWeight: '600',
  },
  warn: {
    color: colors.warn,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  chatScroll: {
    maxHeight: 280,
    marginBottom: 10,
    backgroundColor: colors.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chatContent: {
    padding: 12,
    gap: 10,
  },
  placeholder: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  bubble: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  bubbleUser: {
    backgroundColor: colors.signalSoft,
    alignSelf: 'flex-end',
    maxWidth: '94%',
  },
  bubbleAi: {
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
    maxWidth: '94%',
    borderWidth: 2,
    borderColor: colors.line,
  },
  bubbleRole: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.slate,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  bubbleTxt: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 28,
    letterSpacing: 0.35,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0.3,
    minHeight: 64,
    marginBottom: 10,
  },
  send: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.55 },
  sendTxt: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secondary: {
    flex: 1,
    backgroundColor: colors.mist,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.line,
    minHeight: 50,
    justifyContent: 'center',
  },
  secondaryTxt: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.25,
  },
  stop: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  clear: { alignItems: 'center', paddingVertical: 12 },
  clearTxt: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.25,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.2,
    marginTop: 4,
  },
});
