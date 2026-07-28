export const AUTH_ERRORS = {
  network:        'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.',
  generic:        'Что-то пошло не так. Попробуйте ещё раз.',
  emailTaken:     'Этот email уже зарегистрирован.',
  wrongCredentials: 'Неверный email или пароль.',
  accountBlocked: 'Ваш аккаунт заблокирован. Обратитесь к администратору.',
} as const;
