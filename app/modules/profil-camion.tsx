import { useCallback, useMemo, useState } from 'react';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useI18n } from '../../src/context/I18nContext';
import {
  DEFAULT_TRUCKER_PROFILE,
  SPECIAL_EQUIPMENT_OPTIONS,
  TRAILER_TYPE_OPTIONS,
  TRUCK_TYPE_OPTIONS,
  equipmentLabel,
  loadTruckerProfile,
  saveTruckerProfile,
  trailerTypeLabel,
  truckTypeLabel,
  type SpecialEquipment,
  type TrailerType,
  type TruckType,
  type TruckerProfile,
} from '../../src/services/prefs/truckerProfilePrefs';
import { buildRouteRulesFromProfile, type RouteRule } from '../../src/services/trucker/routeRules';
import { colors } from '../../src/theme/colors';

/**
 * Profil camionneur — type trek, marque/modèle/année, L/W/H, poids, essieux,
 * équipement spécial, type de remorque, routes autorisées / restreintes (advisory).
 */
export default function ProfilCamionScreen() {
  const { locale } = useI18n();
  const lang = locale === 'en' ? 'en' : 'fr';
  const [profile, setProfile] = useState<TruckerProfile>(DEFAULT_TRUCKER_PROFILE);
  const [draft, setDraft] = useState<TruckerProfile>(DEFAULT_TRUCKER_PROFILE);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const p = await loadTruckerProfile();
        if (cancelled) return;
        setProfile(p);
        setDraft(p);
        setReady(true);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const rules = useMemo(() => buildRouteRulesFromProfile(editing ? draft : profile), [editing, draft, profile]);

  const patchDraft = (patch: Partial<TruckerProfile>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const toggleEquip = (id: SpecialEquipment) => {
    setDraft((prev) => {
      const has = prev.specialEquipment.includes(id);
      const specialEquipment = has
        ? prev.specialEquipment.filter((x) => x !== id)
        : [...prev.specialEquipment, id];
      return { ...prev, specialEquipment };
    });
  };

  const onSave = async () => {
    const next = await saveTruckerProfile(draft);
    setProfile(next);
    setDraft(next);
    setEditing(false);
    setMsg(
      lang === 'en'
        ? 'Truck profile saved · synced to GPS truck costing'
        : 'Profil camion enregistré · sync gabarit GPS (Valhalla truck)',
    );
  };

  const onCancel = () => {
    setDraft(profile);
    setEditing(false);
    setMsg(null);
  };

  const display = editing ? draft : profile;
  const yearStr = String(display.year);

  return (
    <>
      <Stack.Screen
        options={{
          title: lang === 'en' ? 'Trucker profile' : 'Profil camion',
        }}
      />
      <Screen
        variant="stack"
        title={lang === 'en' ? 'Trucker profile' : 'Profil camion'}
        subtitle={
          lang === 'en'
            ? 'Truck · trailer · dims · allowed / restricted routes'
            : 'Camion · remorque · gabarit · routes autorisées / restreintes'
        }
      >
        <StubBanner
          text={
            lang === 'en'
              ? 'Local profile · feeds Valhalla truck + OSM height/weight advisories (not certified PTAC).'
              : 'Profil local · alimente Valhalla truck + alertes gabarit OSM (pas de PTAC certifié).'
          }
        />

        {!ready ? (
          <Card>
            <Text style={styles.meta}>{lang === 'en' ? 'Loading…' : 'Chargement…'}</Text>
          </Card>
        ) : (
          <>
            <Card title={lang === 'en' ? 'Vehicle sheet' : 'Fiche véhicule'}>
              <View style={styles.heroRow}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeTxt}>{truckTypeLabel(display.truckType, lang)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>
                    {[display.make, display.model].filter(Boolean).join(' ') ||
                      (lang === 'en' ? 'Make / model not set' : 'Marque / modèle non renseignés')}
                  </Text>
                  <Text style={styles.heroSub}>
                    {display.year} · {trailerTypeLabel(display.trailerType, lang)} · {display.region}
                  </Text>
                </View>
              </View>

              {!editing ? (
                <>
                  <Field
                    label={lang === 'en' ? 'Truck type' : 'Type camion'}
                    value={truckTypeLabel(display.truckType, lang)}
                  />
                  <Field label={lang === 'en' ? 'Make' : 'Marque'} value={display.make || '—'} />
                  <Field label={lang === 'en' ? 'Model' : 'Modèle'} value={display.model || '—'} />
                  <Field label={lang === 'en' ? 'Year' : 'Année'} value={yearStr} />
                  <Text style={styles.section}>{lang === 'en' ? 'Dimensions (L / W / H)' : 'Gabarit (L / W / H)'}</Text>
                  <View style={styles.dimsRow}>
                    <DimChip label="L" value={`${display.lengthM.toFixed(2)} m`} />
                    <DimChip label="W" value={`${display.widthM.toFixed(2)} m`} />
                    <DimChip label="H" value={`${display.heightM.toFixed(2)} m`} />
                  </View>
                  <Field
                    label={lang === 'en' ? 'Weight (GVWR / PTAC)' : 'Poids (PTAC)'}
                    value={`${display.weightT.toFixed(1)} t`}
                  />
                  <Field
                    label={lang === 'en' ? 'Axles' : 'Essieux'}
                    value={String(display.axles)}
                  />
                  <Field
                    label={lang === 'en' ? 'Trailer' : 'Remorque'}
                    value={trailerTypeLabel(display.trailerType, lang)}
                  />
                  <Text style={styles.section}>
                    {lang === 'en' ? 'Special equipment' : 'Équipement spécial'}
                  </Text>
                  {display.specialEquipment.length === 0 ? (
                    <Text style={styles.meta}>
                      {lang === 'en' ? 'None selected' : 'Aucun sélectionné'}
                    </Text>
                  ) : (
                    <View style={styles.chipWrap}>
                      {display.specialEquipment.map((id) => (
                        <View key={id} style={styles.equipChip}>
                          <Text style={styles.equipChipTxt}>{equipmentLabel(id, lang)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Pressable style={styles.primary} onPress={() => setEditing(true)}>
                    <Text style={styles.primaryTxt}>
                      {lang === 'en' ? 'Edit profile' : 'Modifier le profil'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.section}>{lang === 'en' ? 'Truck type' : 'Type camion'}</Text>
                  <View style={styles.chipWrap}>
                    {TRUCK_TYPE_OPTIONS.map((o) => (
                      <Pressable
                        key={o.id}
                        style={[styles.pick, draft.truckType === o.id && styles.pickOn]}
                        onPress={() => patchDraft({ truckType: o.id as TruckType })}
                      >
                        <Text style={[styles.pickTxt, draft.truckType === o.id && styles.pickTxtOn]}>
                          {lang === 'en' ? o.labelEn : o.labelFr}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <LabeledInput
                    label={lang === 'en' ? 'Make' : 'Marque'}
                    value={draft.make}
                    onChangeText={(make) => patchDraft({ make })}
                    placeholder="Volvo / Freightliner / …"
                  />
                  <LabeledInput
                    label={lang === 'en' ? 'Model' : 'Modèle'}
                    value={draft.model}
                    onChangeText={(model) => patchDraft({ model })}
                    placeholder="FH16 / Cascadia / …"
                  />
                  <LabeledInput
                    label={lang === 'en' ? 'Year' : 'Année'}
                    value={String(draft.year)}
                    onChangeText={(v) => patchDraft({ year: parseInt(v.replace(/\D/g, ''), 10) || draft.year })}
                    keyboardType="number-pad"
                    placeholder="2020"
                  />

                  <Text style={styles.section}>{lang === 'en' ? 'Dimensions (m)' : 'Gabarit (m)'}</Text>
                  <View style={styles.row3}>
                    <NumField
                      label="L"
                      value={draft.lengthM}
                      onChange={(lengthM) => patchDraft({ lengthM })}
                    />
                    <NumField
                      label="W"
                      value={draft.widthM}
                      onChange={(widthM) => patchDraft({ widthM })}
                    />
                    <NumField
                      label="H"
                      value={draft.heightM}
                      onChange={(heightM) => patchDraft({ heightM })}
                    />
                  </View>
                  <View style={styles.row3}>
                    <NumField
                      label={lang === 'en' ? 't' : 't'}
                      value={draft.weightT}
                      onChange={(weightT) => patchDraft({ weightT })}
                    />
                    <NumField
                      label={lang === 'en' ? 'Axles' : 'Essieux'}
                      value={draft.axles}
                      onChange={(axles) => patchDraft({ axles: Math.round(axles) })}
                      integer
                    />
                    <View style={{ flex: 1 }} />
                  </View>

                  <Text style={styles.section}>{lang === 'en' ? 'Trailer type' : 'Type de remorque'}</Text>
                  <View style={styles.chipWrap}>
                    {TRAILER_TYPE_OPTIONS.map((o) => (
                      <Pressable
                        key={o.id}
                        style={[styles.pick, draft.trailerType === o.id && styles.pickOn]}
                        onPress={() => patchDraft({ trailerType: o.id as TrailerType })}
                      >
                        <Text style={[styles.pickTxt, draft.trailerType === o.id && styles.pickTxtOn]}>
                          {lang === 'en' ? o.labelEn : o.labelFr}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.section}>
                    {lang === 'en' ? 'Special equipment' : 'Équipement spécial'}
                  </Text>
                  {SPECIAL_EQUIPMENT_OPTIONS.map((o) => {
                    const on = draft.specialEquipment.includes(o.id);
                    return (
                      <View key={o.id} style={styles.switchRow}>
                        <Text style={styles.switchLabel}>{lang === 'en' ? o.labelEn : o.labelFr}</Text>
                        <Switch
                          value={on}
                          onValueChange={() => toggleEquip(o.id)}
                          trackColor={{ false: colors.line, true: colors.garageSoft }}
                          thumbColor={on ? colors.garage : colors.muted}
                        />
                      </View>
                    );
                  })}

                  <Text style={styles.section}>
                    {lang === 'en' ? 'Region (regs hint)' : 'Région (lois / gabarits)'}
                  </Text>
                  <View style={styles.chipWrap}>
                    {(['EU', 'NA', 'AU'] as const).map((r) => (
                      <Pressable
                        key={r}
                        style={[styles.pick, draft.region === r && styles.pickOn]}
                        onPress={() => patchDraft({ region: r })}
                      >
                        <Text style={[styles.pickTxt, draft.region === r && styles.pickTxtOn]}>{r}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.row}>
                    <Pressable style={[styles.secondary, { flex: 1 }]} onPress={onCancel}>
                      <Text style={styles.secondaryTxt}>{lang === 'en' ? 'Cancel' : 'Annuler'}</Text>
                    </Pressable>
                    <Pressable style={[styles.primary, { flex: 1 }]} onPress={() => void onSave()}>
                      <Text style={styles.primaryTxt}>{lang === 'en' ? 'Save' : 'Enregistrer'}</Text>
                    </Pressable>
                  </View>
                </>
              )}
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            </Card>

            <Card title={lang === 'en' ? 'Allowed routes (advisory)' : 'Routes autorisées (advisory)'}>
              <Text style={styles.dimsLine}>{rules.dimsLine}</Text>
              {rules.allowed.map((r) => (
                <RuleRow key={r.id} rule={r} />
              ))}
            </Card>

            <Card title={lang === 'en' ? 'Restricted / avoid' : 'Restreintes / à éviter'}>
              {rules.restricted.map((r) => (
                <RuleRow key={r.id} rule={r} />
              ))}
              <Text style={styles.honesty}>{rules.honesty}</Text>
            </Card>

            <Card title={lang === 'en' ? 'Open on map' : 'Ouvrir sur la carte'}>
              <Text style={styles.meta}>
                {lang === 'en'
                  ? 'Saved dims sync to Camion mode (Valhalla truck + OSM pins).'
                  : 'Le gabarit sauvé alimente le mode Camion (Valhalla truck + pins OSM).'}
              </Text>
              <Link href="/(tabs)/carte" asChild>
                <Pressable style={styles.primary}>
                  <Text style={styles.primaryTxt}>
                    {lang === 'en' ? 'GPS map (truck mode)' : 'Carte GPS (mode camion)'}
                  </Text>
                </Pressable>
              </Link>
              <Link href="/modules/routiers" asChild>
                <Pressable style={styles.secondary}>
                  <Text style={styles.secondaryTxt}>
                    {lang === 'en' ? 'Weigh stations (M8)' : 'Balances / routiers (M8)'}
                  </Text>
                </Pressable>
              </Link>
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function DimChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dimChip}>
      <Text style={styles.dimLabel}>{label}</Text>
      <Text style={styles.dimValue}>{value}</Text>
    </View>
  );
}

function RuleRow({ rule }: { rule: RouteRule }) {
  const ok = rule.kind === 'allowed';
  return (
    <View style={[styles.rule, ok ? styles.ruleOk : styles.ruleNo]}>
      <Text style={[styles.ruleTitle, ok ? styles.ruleTitleOk : styles.ruleTitleNo]}>{rule.title}</Text>
      <Text style={styles.ruleDetail}>{rule.detail}</Text>
      <Text style={styles.ruleBasis}>{rule.basis}</Text>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function NumField({
  label,
  value,
  onChange,
  integer,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  integer?: boolean;
}) {
  const format = useCallback(
    (n: number) => (integer ? String(Math.round(n)) : n.toFixed(2)),
    [integer],
  );
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={focused ? text : format(value)}
        onFocus={() => {
          setText(format(value));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChangeText={(v) => {
          setText(v);
          const n = integer ? parseInt(v.replace(/\D/g, ''), 10) : Number(v.replace(',', '.'));
          if (Number.isFinite(n)) onChange(n);
        }}
        keyboardType="decimal-pad"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  msg: { color: colors.garage, fontWeight: '700', fontSize: 13, marginTop: 4 },
  section: { fontWeight: '800', color: colors.ink, fontSize: 13, marginTop: 8 },
  heroRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 6 },
  heroBadge: {
    backgroundColor: colors.garageSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.garage,
  },
  heroBadgeTxt: { color: colors.garage, fontWeight: '800', fontSize: 12 },
  heroTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  heroSub: { color: colors.slate, fontSize: 12, fontWeight: '600', marginTop: 2 },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  fieldValue: { color: colors.ink, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  dimsRow: { flexDirection: 'row', gap: 8 },
  dimChip: {
    flex: 1,
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  dimLabel: { color: colors.muted, fontWeight: '800', fontSize: 11 },
  dimValue: { color: colors.ink, fontWeight: '800', fontSize: 14, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  equipChip: {
    backgroundColor: colors.signalSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.signal,
  },
  equipChipTxt: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  pick: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pickOn: { backgroundColor: colors.garage, borderColor: colors.garage },
  pickTxt: { color: colors.slate, fontWeight: '700', fontSize: 12 },
  pickTxtOn: { color: colors.white },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: { color: colors.ink, fontWeight: '600', fontSize: 13, flex: 1, paddingRight: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  row3: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.ink,
    backgroundColor: colors.white,
    fontWeight: '600',
  },
  primary: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryTxt: { color: colors.white, fontWeight: '800', fontSize: 14 },
  secondary: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryTxt: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  dimsLine: { color: colors.slate, fontWeight: '700', fontSize: 12, marginBottom: 4 },
  rule: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    gap: 2,
  },
  ruleOk: { backgroundColor: colors.garageSoft, borderColor: colors.garage },
  ruleNo: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  ruleTitle: { fontWeight: '800', fontSize: 13 },
  ruleTitleOk: { color: colors.garage },
  ruleTitleNo: { color: colors.danger },
  ruleDetail: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  ruleBasis: { color: colors.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  honesty: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 6 },
});
