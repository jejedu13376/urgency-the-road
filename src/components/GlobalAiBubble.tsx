import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilAiAgentCard } from './FilAiAgentCard';
import { useI18n } from '../context/I18nContext';
import { colors } from '../theme/colors';

/**
 * Global floating AI chat bubble — visible on every unlocked screen.
 * Opens a dyslexia-friendly overlay sheet (same agent as Fil / Multi-IA).
 * Sits left of the tab bar; SOS stays on the right (see SosButton).
 */
const TAB_BAR_CONTENT = 40;
const FAB_GAP = 12;
const FAB_SIZE = 58;

export function GlobalAiBubble() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const bottom = Math.max(insets.bottom, 8) + TAB_BAR_CONTENT + FAB_GAP;
  // Bound sheet height so flex children (chat + composer) can shrink without clipping.
  const sheetHeight = Math.min(winH * 0.92, winH - Math.max(insets.top, 8));

  return (
    <>
      <View style={[styles.fabWrap, { bottom }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? t('fil.aiFabClose') : t('fil.aiFabOpen')}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          onPress={() => setOpen((v) => !v)}
          testID="global-ai-bubble"
        >
          <Text style={styles.fabTxt} allowFontScaling={false}>
            AI
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('fil.aiFabClose')}
          />
          <View
            style={[
              styles.sheet,
              {
                height: sheetHeight,
                paddingTop: Math.max(insets.top, 12),
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('fil.aiTitle')}</Text>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('fil.aiFabClose')}
              >
                <Text style={styles.closeTxt}>{t('close')}</Text>
              </Pressable>
            </View>
            <View style={styles.sheetBody}>
              <FilAiAgentCard variant="sheet" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    left: 14,
    zIndex: 30,
    alignSelf: 'flex-start',
    width: FAB_SIZE,
  },
  fab: {
    backgroundColor: colors.signal,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    elevation: 4,
  },
  fabTxt: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.6,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 24, 32, 0.45)',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: colors.line,
    borderBottomWidth: 0,
    flexDirection: 'column',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
  sheetTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeBtn: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: colors.line,
    minHeight: 44,
    justifyContent: 'center',
  },
  closeTxt: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.25,
  },
});
