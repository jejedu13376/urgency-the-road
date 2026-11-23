import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Soft catch for render/lifecycle Uncaught Errors so Expo preview
 * stays usable (mock / retry) instead of a white screen.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[AppErrorBoundary]', error.message, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap} accessibilityRole="alert">
          <Text style={styles.title}>Écran indisponible (soft-fail)</Text>
          <Text style={styles.body}>
            Erreur non fatale — réessayez. Les modules restent en mock si Firebase /
            permissions échouent.
          </Text>
          <Text style={styles.detail} numberOfLines={4}>
            {this.state.error.message}
          </Text>
          <Pressable style={styles.btn} onPress={this.retry}>
            <Text style={styles.btnTxt}>Réessayer</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14, color: colors.slate, lineHeight: 20 },
  detail: { fontSize: 12, color: colors.muted, fontFamily: 'monospace' },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.signal,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  btnTxt: { color: colors.white, fontWeight: '800' },
});
