/**
 * 多语言配置
 * 支持：俄语、英语、法语、西班牙语、阿拉伯语
 */

export const LANGUAGE_CONFIG = {
  ru: {
    name: 'русский',
    nativeName: 'Русский',
    promptLang: 'на русском языке (кириллица)',
    seoExpert: 'Ты эксперт по SEO для Яндекс и Google',
    market: 'из Китая в Россию',
    region: 'Владивосток',
    // PDF标签
    pdf: {
      specs: 'Основные параметры',
      brand: 'Марка',
      model: 'Модель',
      year: 'Год выпуска',
      color: 'Цвет',
      mileage: 'Пробег',
      displacement: 'Объем двигателя',
      horsepower: 'Мощность',
      transmission: 'Коробка передач',
      drive: 'Привод',
      config: 'Полная конфигурация',
      condition: 'Состояние автомобиля',
      contacts: 'Контакты',
      website: 'Сайт',
      phone: 'Телефон',
      page: 'Страница',
      safety: 'Безопасность',
      comfort: 'Комфорт',
      multimedia: 'Мультимедиа',
      assist: 'Помощь водителю',
      engine: 'Двигатель'
    }
  },
  en: {
    name: 'English',
    nativeName: 'English',
    promptLang: 'in English',
    seoExpert: 'You are an SEO expert for Google',
    market: 'export from China',
    region: 'shipping worldwide',
    pdf: {
      specs: 'Specifications',
      brand: 'Brand',
      model: 'Model',
      year: 'Year',
      color: 'Color',
      mileage: 'Mileage',
      displacement: 'Engine Size',
      horsepower: 'Power',
      transmission: 'Transmission',
      drive: 'Drivetrain',
      config: 'Full Configuration',
      condition: 'Vehicle Condition',
      contacts: 'Contacts',
      website: 'Website',
      phone: 'Phone',
      page: 'Page',
      safety: 'Safety',
      comfort: 'Comfort',
      multimedia: 'Multimedia',
      assist: 'Driver Assistance',
      engine: 'Engine'
    }
  },
  fr: {
    name: 'français',
    nativeName: 'Français',
    promptLang: 'en français',
    seoExpert: 'Vous êtes un expert SEO pour Google',
    market: 'export depuis la Chine',
    region: 'livraison mondiale',
    pdf: {
      specs: 'Spécifications',
      brand: 'Marque',
      model: 'Modèle',
      year: 'Année',
      color: 'Couleur',
      mileage: 'Kilométrage',
      displacement: 'Cylindrée',
      horsepower: 'Puissance',
      transmission: 'Transmission',
      drive: 'Transmission',
      config: 'Configuration complète',
      condition: 'État du véhicule',
      contacts: 'Contacts',
      website: 'Site web',
      phone: 'Téléphone',
      page: 'Page',
      safety: 'Sécurité',
      comfort: 'Confort',
      multimedia: 'Multimédia',
      assist: 'Aide à la conduite',
      engine: 'Moteur'
    }
  },
  es: {
    name: 'español',
    nativeName: 'Español',
    promptLang: 'en español',
    seoExpert: 'Eres un experto en SEO para Google',
    market: 'exportación desde China',
    region: 'envío mundial',
    pdf: {
      specs: 'Especificaciones',
      brand: 'Marca',
      model: 'Modelo',
      year: 'Año',
      color: 'Color',
      mileage: 'Kilometraje',
      displacement: 'Cilindrada',
      horsepower: 'Potencia',
      transmission: 'Transmisión',
      drive: 'Tracción',
      config: 'Configuración completa',
      condition: 'Estado del vehículo',
      contacts: 'Contactos',
      website: 'Sitio web',
      phone: 'Teléfono',
      page: 'Página',
      safety: 'Seguridad',
      comfort: 'Confort',
      multimedia: 'Multimedia',
      assist: 'Asistencia al conductor',
      engine: 'Motor'
    }
  },
  ar: {
    name: 'العربية',
    nativeName: 'العربية',
    promptLang: 'باللغة العربية',
    seoExpert: 'أنت خبير في تحسين محركات البحث لجوجل',
    market: 'التصدير من الصين',
    region: 'الشحن عالميًا',
    rtl: true,
    pdf: {
      specs: 'المواصفات',
      brand: 'الماركة',
      model: 'الموديل',
      year: 'السنة',
      color: 'اللون',
      mileage: 'المسافة المقطوعة',
      displacement: 'سعة المحرك',
      horsepower: 'القوة',
      transmission: 'ناقل الحركة',
      drive: 'نظام الدفع',
      config: 'التكوين الكامل',
      condition: 'حالة السيارة',
      contacts: 'جهات الاتصال',
      website: 'الموقع الإلكتروني',
      phone: 'الهاتف',
      page: 'صفحة',
      safety: 'الأمان',
      comfort: 'الراحة',
      multimedia: 'الوسائط المتعددة',
      assist: 'مساعدة السائق',
      engine: 'المحرك'
    }
  }
};

/**
 * 获取语言配置
 */
export function getLanguageConfig(lang) {
  return LANGUAGE_CONFIG[lang] || LANGUAGE_CONFIG.ru;
}
