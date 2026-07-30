export const CHECKOUT_LABELS = {
  return: {
    processing: 'Обрабатываем платёж...',
    success: 'Оплата прошла успешно!',
    failed: 'Оплата не прошла',
    missingOrder: 'Не указан номер заказа',
    networkError: 'Не удалось проверить статус заказа',
    backHome: 'На главную',
  },

  devStub: {
    title: 'Тестовая страница оплаты ЮKassa',
    description: 'Эта страница доступна только в режиме YOOKASSA_MODE=stub.',
    pay: 'Оплатить',
    cancel: 'Отменить',
    processing: 'Обрабатываем...',
    result: 'Уведомление отправлено. Вернитесь на страницу заказа, чтобы увидеть результат.',
    error: 'Не удалось отправить уведомление',
  },
} as const
