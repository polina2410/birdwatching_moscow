# Admin Features — Spec Index

This feature is split into four independent specs, each implementable on its own branch. Implement in order (later specs depend on earlier ones).

| # | Spec | Branch | Depends on |
|---|---|---|---|
| 1 | [walk-expedition-split](../walk-expedition-split/spec.md) | `walk-expedition-split` | — |
| 2 | [django-setup](../django-setup/spec.md) | `django-setup` | `walk-expedition-split` |
| 3 | [django-admin-registration](../django-admin-registration/spec.md) | `django-admin-registration` | `django-setup` |
| 4 | [admin-navigation-button](../admin-navigation-button/spec.md) | `admin-navigation-button` | `django-setup` |

The original user story is in [story.md](./story.md).
