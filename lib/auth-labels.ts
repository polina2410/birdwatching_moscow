export const AUTH_LABELS = {
  common: {
    emailField:   'Email',
    passwordField: 'Пароль',
    backToLogin:  'Вернуться ко входу',
  },

  register: {
    title:        'Создать аккаунт',
    nameField:    'Имя',
    submit:       'Создать аккаунт',
    submitting:   'Создаём аккаунт…',
    loginLink:    'Уже есть аккаунт? Войти',
  },

  login: {
    title:        'Вход',
    submit:       'Войти',
    submitting:   'Входим…',
    registerLink: 'Создать аккаунт',
    resetLink:    'Забыли пароль?',
    registered:   'Регистрация прошла успешно. Войдите в аккаунт.',
    passwordReset: 'Пароль обновлён. Войдите в аккаунт.',
  },

  resetRequest: {
    title:        'Сброс пароля',
    description:  'Введите email и мы отправим вам ссылку для сброса пароля.',
    submit:       'Отправить ссылку',
    submitting:   'Отправляем…',
    successTitle: 'Проверьте почту',
    successText:  'Если этот email зарегистрирован, мы отправили ссылку для сброса пароля.',
  },

  resetConfirm: {
    title:          'Новый пароль',
    newPasswordField: 'Новый пароль',
    submit:         'Сохранить пароль',
    submitting:     'Сохраняем…',
  },
} as const;
