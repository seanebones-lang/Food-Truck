import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAccessibility, useRTLStyles } from '../utils/accessibility';
import i18n, { isRTL } from '../i18n/config';

const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

interface LanguageSelectorProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Language selector component with RTL support
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ visible, onClose }) => {
  const { t, i18n: i18nInstance } = useTranslation();
  const { getButtonProps } = useAccessibility();
  const { getRTLStyle, getTextAlign } = useRTLStyles();
  const currentLang = i18nInstance.language.split('-')[0];

  const changeLanguage = async (langCode: string) => {
    await i18nInstance.changeLanguage(langCode);
    // Force RTL layout update if needed
    if (isRTL() !== (langCode === 'ar')) {
      // Trigger re-render for RTL changes
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, getRTLStyle(styles.modalLTR, styles.modalRTL)]}>
          <Text
            style={[styles.title, { textAlign: getTextAlign('left') }]}
            {...getButtonProps('profile.changeLanguage')}
          >
            {t('profile.changeLanguage')}
          </Text>

          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageItem,
                currentLang === lang.code && styles.languageItemSelected,
              ]}
              onPress={() => changeLanguage(lang.code)}
              {...getButtonProps('common.confirm', undefined, { label: lang.nativeName })}
            >
              <Text
                style={[
                  styles.languageText,
                  currentLang === lang.code && styles.languageTextSelected,
                  { textAlign: getTextAlign('left') },
                ]}
              >
                {lang.nativeName}
              </Text>
              {currentLang === lang.code && (
                <Text style={styles.checkmark} accessibilityLabel="Selected">
                  ✓
                </Text>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            {...getButtonProps('common.cancel')}
          >
            <Text style={styles.closeButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalLTR: {
    // LTR styles (default)
  },
  modalRTL: {
    // RTL styles - will be applied when isRTL is true
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    minHeight: 44,
  },
  languageItemSelected: {
    backgroundColor: '#f4511e',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  languageTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    minHeight: 44,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
