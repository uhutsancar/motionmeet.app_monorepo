import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  STORY_OVERLAY_LIMITS,
  type StoryOverlay,
  type StoryOverlayAlignment,
  type StoryOverlayBackdrop,
} from '@motionmeet/shared';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import {
  STORY_FONTS,
  STORY_TEXT_COLORS,
  storyBaseFontSize,
  storyFont,
  storyTextColor,
  storyTextTransform,
} from './storyTypography';

interface StoryTextEditorProps {
  overlay: StoryOverlay;
  onCancel: () => void;
  onDone: (overlay: StoryOverlay) => void;
}

/** Which of the two option strips, if either, is currently open. */
type OpenTray = 'none' | 'font' | 'color';

const ALIGN_ICON: Record<StoryOverlayAlignment, React.ComponentProps<typeof Ionicons>['name']> = {
  left: 'menu-outline',
  center: 'reorder-four-outline',
  right: 'menu-outline',
};

const NEXT_ALIGN: Record<StoryOverlayAlignment, StoryOverlayAlignment> = {
  center: 'left',
  left: 'right',
  right: 'center',
};

const NEXT_BACKDROP: Record<StoryOverlayBackdrop, StoryOverlayBackdrop> = {
  none: 'plate',
  plate: 'translucent',
  translucent: 'none',
};

/**
 * The typing surface for one caption.
 *
 * It is deliberately the only place the keyboard is allowed to open: the
 * composer behind it never focuses an input, so a caption can be dragged
 * around without the keyboard jumping in. Tapping anywhere outside the text
 * commits what was typed and puts the keyboard away.
 *
 * The type and colour choices are folded away behind two small chips rather
 * than laid out as two full rows of swatches. A row of five faces and a row of
 * ten dots is a lot of furniture to look at while writing two words, and it ate
 * the bottom third of the picture; one strip opens at a time, only when asked
 * for, and closes again on the next choice.
 */
const StoryTextEditor = ({ overlay, onCancel, onDone }: StoryTextEditorProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const keyboard = useKeyboardInset();
  const inputRef = useRef<TextInput>(null);

  const [draft, setDraft] = useState(overlay);
  const [tray, setTray] = useState<OpenTray>('none');
  const font = storyFont(draft.font);
  const fontSize = storyBaseFontSize(width);

  useEffect(() => {
    // A short delay lets the surface finish mounting before the keyboard
    // animates in; focusing immediately is dropped on some Android builds.
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  const commit = () => {
    Keyboard.dismiss();
    const text = draft.text.trim();
    if (!text) {
      onCancel();
      return;
    }
    onDone({ ...draft, text });
  };

  const inputStyle = useMemo(
    () => [
      font.style,
      {
        color: storyTextColor(draft),
        fontSize,
        lineHeight: fontSize * 1.24,
        textAlign: draft.align,
        textTransform: storyTextTransform(font),
        maxWidth: width * 0.86,
        minWidth: width * 0.42,
      },
      draft.backdrop === 'plate'
        ? { backgroundColor: draft.color, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }
        : draft.backdrop === 'translucent'
          ? {
              backgroundColor: 'rgba(0,0,0,0.42)',
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }
          : null,
    ],
    [draft, font, fontSize, width],
  );

  /* The caption sits above the keyboard rather than behind it. A modal window
     is not resized by either platform when the IME opens, so the space it
     takes has to be reserved here. */
  const bottomInset = keyboard.visible ? keyboard.height : Math.max(insets.bottom, 10);

  return (
    <View style={styles.root}>
      {/* Tapping the dimmed picture behind the caption is the "done" gesture. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={commit}
        accessibilityRole="button"
        accessibilityLabel={t('story.done', 'Bitti')}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => setDraft((current) => ({ ...current, align: NEXT_ALIGN[current.align] }))}
          hitSlop={10}
          style={styles.toolChip}
          accessibilityRole="button"
          accessibilityLabel={t('story.align', 'Hizalama')}
        >
          <Ionicons
            name={ALIGN_ICON[draft.align]}
            size={19}
            color="#FFFFFF"
            style={draft.align === 'right' ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </Pressable>

        <Pressable
          onPress={() =>
            setDraft((current) => ({ ...current, backdrop: NEXT_BACKDROP[current.backdrop] }))
          }
          hitSlop={10}
          style={[styles.toolChip, draft.backdrop !== 'none' && styles.toolChipActive]}
          accessibilityRole="button"
          accessibilityLabel={t('story.text_background', 'Metin arka plani')}
        >
          <Ionicons
            name="color-fill-outline"
            size={19}
            color={draft.backdrop !== 'none' ? '#101014' : '#FFFFFF'}
          />
        </Pressable>

        <View style={styles.spacer} />

        <Pressable onPress={commit} hitSlop={10} accessibilityRole="button" style={styles.doneButton}>
          <Text style={styles.doneLabel}>{t('story.done', 'Bitti')}</Text>
        </Pressable>
      </View>

      <View style={[styles.canvas, { paddingBottom: bottomInset + 70 }]} pointerEvents="box-none">
        <TextInput
          ref={inputRef}
          value={draft.text}
          onChangeText={(text) => setDraft((current) => ({ ...current, text }))}
          multiline
          autoCorrect={false}
          maxLength={STORY_OVERLAY_LIMITS.maxTextLength}
          selectionColor="#9757FB"
          style={inputStyle}
          // Android needs this to keep the caret vertically centred on a
          // multiline field the way iOS does by default.
          textAlignVertical="center"
          keyboardAppearance="dark"
          accessibilityLabel={t('story.add_text', 'Metin ekle')}
        />
      </View>

      <View style={[styles.bottomBar, { paddingBottom: bottomInset }]} pointerEvents="box-none">
        {tray === 'font' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.tray}
          >
            {STORY_FONTS.map((option) => {
              const active = option.key === draft.font;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    setDraft((current) => ({ ...current, font: option.key }));
                    setTray('none');
                  }}
                  style={[styles.fontChip, active && styles.fontChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.sample}
                >
                  <Text
                    numberOfLines={1}
                    style={[option.style, { color: active ? '#101014' : '#FFFFFF', fontSize: 13 }]}
                  >
                    {option.sample}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {tray === 'color' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.tray}
          >
            {STORY_TEXT_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => {
                  setDraft((current) => ({ ...current, color }));
                  setTray('none');
                }}
                style={[styles.swatch, { backgroundColor: color }]}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.color === color }}
                accessibilityLabel={color}
              >
                {draft.color === color && (
                  <Ionicons
                    name="checkmark"
                    size={15}
                    color={color === '#FFFFFF' ? '#101014' : '#FFFFFF'}
                  />
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.controlRow}>
          <Pressable
            onPress={() => setTray((current) => (current === 'font' ? 'none' : 'font'))}
            style={[styles.controlChip, tray === 'font' && styles.controlChipActive]}
            accessibilityRole="button"
            accessibilityState={{ expanded: tray === 'font' }}
            accessibilityLabel={t('story.font', 'Yazi stili')}
          >
            <Text style={[font.style, styles.controlChipLabel]} numberOfLines={1}>
              {font.sample}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTray((current) => (current === 'color' ? 'none' : 'color'))}
            style={[styles.colorButton, tray === 'color' && styles.colorButtonActive]}
            accessibilityRole="button"
            accessibilityState={{ expanded: tray === 'color' }}
            accessibilityLabel={t('story.text_color', 'Yazi rengi')}
          >
            <View style={[styles.colorDot, { backgroundColor: draft.color }]} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
    zIndex: 60,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 8,
    zIndex: 2,
  },
  spacer: { flex: 1 },
  toolChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  toolChipActive: {
    backgroundColor: '#FFFFFF',
  },
  doneButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  doneLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingTop: 6,
  },
  tray: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  controlChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  controlChipActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  controlChipLabel: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  colorButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  colorButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  fontChip: {
    paddingHorizontal: 13,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  fontChipActive: {
    backgroundColor: '#FFFFFF',
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StoryTextEditor;
