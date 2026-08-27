export const AUTH_LABELS = {
  common: {
    emailField:   'Email',
    passwordField: 'Пароль',
    backToLogin:  'Вернуться ко входу',
  },

  register: {
    title:          'Создать аккаунт',
    confirmTitle:   'Подтвердить почту',
    nameField:      'Имя',
    submit:         'Создать аккаунт',
    submitting:     'Отправляем код…',
    loginLink:      'Уже есть аккаунт? Войти',
    codeSentTo:     'Введите код из письма. Код отправлен на',
    codeField:      'Код из письма',
    verify:         'Подтвердить',
    verifying:      'Проверяем…',
    changeEmail:    'Указать другой email',
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

  loginCode: {
    requestCode:       'Получить код',
    requesting:        'Отправляем код…',
    verify:            'Войти',
    verifying:         'Проверяем код…',
    codeField:         'Код из письма',
    codeSentTo:        'Если аккаунт с этой почтой существует, письмо с кодом уже отправлено.',
    resendCode:        'Отправить код снова',
    changeEmail:       'Указать другой email',
  },

  adminPassword: {
    title:      'Введите пароль',
    submit:     'Войти',
    submitting: 'Входим…',
  },

  adminSetPassword: {
    title:        'Создайте пароль',
    passwordField: 'Новый пароль',
    confirmField:  'Подтвердите пароль',
    submit:        'Сохранить и войти',
    submitting:    'Сохраняем…',
    mismatch:      'Пароли не совпадают',
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
