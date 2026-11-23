/**
 * Destination actions sheet after Places autocomplete confirm.
 * Original UX (Maps-inspired actions) — no Google chrome clone.
 */
import { useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatMyLocationShareLine,
  formatPlaceShareLine,
  savePlace,
  updatePlaceTag,
  type GpsPlaceRef,
} from '../../services/prefs/gpsSavedPlaces';
import { colors } from '../../theme/colors';

export type GpsDestinationSelection = {
  lat: number;
  lon: number;
  label: string;
  tag?: string;
};

/** Route state for Démarrer — never conflate pending vs failed. */
export type GpsRouteStatus = 'pending' | 'ready' | 'failed';

type Props = {
  visible: boolean;
  destination: GpsDestinationSelection | null;
  /** Live device fix for « Partager ma location » — read at tap time (ref-safe). */
  getMyLocation: () => { lat: number; lon: number } | null;
  routeStatus: GpsRouteStatus;
  onClose: () => void;
  /** Returns true only when map navigation actually started. */
  onStartNavigation: () => boolean;
  onLabelUpdated?: (place: GpsPlaceRef) => void;
  onFeedback?: (note: string) => void;
};

const DATA_SOURCES_FR =
  'Sources : OpenStreetMap (tuiles), Open-Meteo / Photon (adresses), Valhalla (itinéraires), Overpass (ouvrages / pesage). Données communautaires — pas de Google Maps.';

export function GpsDestinationMenu({
  visible,
  destination,
  getMyLocation,
  routeStatus,
  onClose,
  onStartNavigation,
  onLabelUpdated,
  onFeedback,
}: Props) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [tagModal, setTagModal] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [busy, setBusy] = useState(false);
  /** In-sheet note — hudNote sits under the Modal and is easy to miss. */
  const [sheetNote, setSheetNote] = useState<string | null>(null);

  const dismiss = useCallback(() => {
    setSheetNote(null);
    setPlusOpen(false);
    setTagModal(false);
    onClose();
  }, [onClose]);

  const feedback = useCallback(
    (note: string) => {
      setSheetNote(note);
      onFeedback?.(note);
    },
    [onFeedback],
  );

  const onStart = useCallback(() => {
    if (!destination) return;
    if (routeStatus === 'pending') {
      feedback('Calcul itinéraire en cours — réessayez dans un instant');
      return;
    }
    if (routeStatus === 'failed') {
      feedback('Itinéraire indisponible — choisissez une autre adresse ou réessayez');
      return;
    }
    if (!getMyLocation()) {
      feedback('Démarrer — GPS appareil requis');
      return;
    }
    const started = onStartNavigation();
    if (!started) {
      feedback('Navigation non démarrée — GPS ou itinéraire manquant');
      return;
    }
    dismiss();
  }, [destination, routeStatus, getMyLocation, onStartNavigation, dismiss, feedback]);

  const onShareMyLocation = useCallback(async () => {
    const myLocation = getMyLocation();
    if (!myLocation) {
      feedback('Partage position — GPS appareil requis');
      return;
    }
    try {
      const message = formatMyLocationShareLine(myLocation.lat, myLocation.lon);
      const res = await Share.share({
        message,
        title: 'Ma position',
        url: Platform.OS === 'ios' ? `https://www.openstreetmap.org/?mlat=${myLocation.lat}&mlon=${myLocation.lon}` : undefined,
      });
      feedback(
        res.action === Share.sharedAction ? 'Position partagée' : 'Partage annulé',
      );
    } catch (e) {
      feedback(e instanceof Error ? e.message : 'Partage KO');
    }
  }, [getMyLocation, feedback]);

  const onSavePlace = useCallback(async () => {
    if (!destination) return;
    setBusy(true);
    try {
      // Omit tag → preserve any existing étiquette (do not wipe on re-save).
      const r = await savePlace({
        lat: destination.lat,
        lon: destination.lon,
        label: destination.label,
      });
      if (!r.ok) {
        feedback(r.error);
        return;
      }
      feedback(`Lieu enregistré · ${r.place.tag ? r.place.tag + ' · ' : ''}${r.place.label}`);
      onLabelUpdated?.(r.place);
    } finally {
      setBusy(false);
    }
  }, [destination, feedback, onLabelUpdated]);

  const openTagEditor = useCallback(() => {
    if (!destination) return;
    setTagDraft(destination.tag ?? '');
    setTagModal(true);
  }, [destination]);

  const commitTag = useCallback(async () => {
    if (!destination) return;
    setBusy(true);
    try {
      const r = await updatePlaceTag(
        destination.lat,
        destination.lon,
        tagDraft,
        destination.label,
      );
      if (!r.ok) {
        feedback(r.error);
        return;
      }
      feedback(
        r.place.tag
          ? `Étiquette « ${r.place.tag} » enregistrée`
          : 'Étiquette retirée — lieu conservé',
      );
      onLabelUpdated?.(r.place);
      setTagModal(false);
    } finally {
      setBusy(false);
    }
  }, [destination, tagDraft, feedback, onLabelUpdated]);

  const stubAction = useCallback(
    (title: string) => {
      feedback(`${title} — pas encore disponible (stub honnête)`);
    },
    [feedback],
  );

  const startHint =
    routeStatus === 'pending'
      ? 'itinéraire…'
      : routeStatus === 'failed'
        ? 'indisponible'
        : undefined;

  if (!destination) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={dismiss}
      >
        <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Fermer le menu destination" />
        <View style={styles.sheet} accessibilityLabel="Actions destination">
          <View style={styles.handle} />
          <Text style={styles.title} numberOfLines={2}>
            {destination.tag ? `${destination.tag} · ` : ''}
            {destination.label}
          </Text>
          <Text style={styles.coords} numberOfLines={1}>
            {destination.lat.toFixed(5)}, {destination.lon.toFixed(5)}
          </Text>

          {sheetNote ? (
            <View style={styles.sheetNote} accessibilityLiveRegion="polite">
              <Text style={styles.sheetNoteTxt}>{sheetNote}</Text>
            </View>
          ) : null}

          <ActionRow
            label="Démarrer"
            emphasis
            disabled={busy}
            onPress={onStart}
            hint={startHint}
          />
          <ActionRow label="Partager ma location" disabled={busy} onPress={() => void onShareMyLocation()} />
          <ActionRow label="Enregistrer le lieu" disabled={busy} onPress={() => void onSavePlace()} />
          <ActionRow
            label="Modifier ou ajouter une étiquette"
            disabled={busy}
            onPress={openTagEditor}
          />

          <Pressable
            style={styles.plusToggle}
            onPress={() => setPlusOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: plusOpen }}
          >
            <Text style={styles.plusToggleTxt}>{plusOpen ? 'Moins' : 'Plus'}</Text>
          </Pressable>

          {plusOpen ? (
            <View style={styles.plusBlock}>
              <ActionRow
                label="Ajouter au contact"
                muted
                onPress={() => stubAction('Ajouter au contact')}
              />
              <ActionRow
                label="Télécharger la carte hors ligne"
                muted
                onPress={() => stubAction('Carte hors ligne')}
              />
              <ActionRow
                label="Voir l'historique des visites"
                muted
                onPress={() => stubAction('Historique des visites')}
              />
              <ActionRow
                label="À propos des sources de données"
                muted
                onPress={() => feedback(DATA_SOURCES_FR)}
              />
              {destination ? (
                <Text style={styles.shareHint} numberOfLines={2}>
                  {formatPlaceShareLine(destination).split('\n')[0]}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Pressable style={styles.closeBtn} onPress={dismiss}>
            <Text style={styles.closeTxt}>Fermer</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={tagModal} animationType="fade" transparent onRequestClose={() => setTagModal(false)}>
        <View style={styles.tagBackdrop}>
          <View style={styles.tagCard}>
            <Text style={styles.tagTitle}>Étiquette</Text>
            <TextInput
              value={tagDraft}
              onChangeText={setTagDraft}
              placeholder="Maison, dépôt, client…"
              placeholderTextColor={colors.muted}
              style={styles.tagInput}
              maxLength={48}
              autoFocus
              accessibilityLabel="Étiquette du lieu"
            />
            <View style={styles.tagActions}>
              <Pressable style={styles.tagGhost} onPress={() => setTagModal(false)}>
                <Text style={styles.tagGhostTxt}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.tagSave} onPress={() => void commitTag()} disabled={busy}>
                <Text style={styles.tagSaveTxt}>Enregistrer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ActionRow({
  label,
  onPress,
  emphasis,
  muted,
  disabled,
  hint,
}: {
  label: string;
  onPress: () => void;
  emphasis?: boolean;
  muted?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Pressable
      style={[styles.row, emphasis && styles.rowEmphasis, muted && styles.rowMuted]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.rowTxt, emphasis && styles.rowTxtEmphasis, muted && styles.rowTxtMuted]}>
        {label}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,24,32,0.35)',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    maxHeight: '72%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  coords: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 12,
  },
  sheetNote: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  sheetNoteTxt: {
    color: colors.slate,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowEmphasis: {
    backgroundColor: colors.signalSoft,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  rowMuted: {
    opacity: 0.92,
  },
  rowTxt: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  rowTxtEmphasis: {
    color: colors.signal,
    fontWeight: '800',
  },
  rowTxtMuted: {
    color: colors.slate,
    fontWeight: '600',
  },
  hint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  plusToggle: {
    marginTop: 10,
    paddingVertical: 10,
  },
  plusToggleTxt: {
    color: colors.slate,
    fontWeight: '800',
    fontSize: 13,
  },
  plusBlock: {
    marginBottom: 4,
  },
  shareHint: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '500',
  },
  closeBtn: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeTxt: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13,
  },
  tagBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,24,32,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  tagCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
  },
  tagTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 10,
  },
  tagInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 14,
  },
  tagActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  tagGhost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tagGhostTxt: {
    color: colors.muted,
    fontWeight: '700',
  },
  tagSave: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tagSaveTxt: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
});
