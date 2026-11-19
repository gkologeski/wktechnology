# Preparation UI

- Presentational forms receive bounded picker results and callbacks; why: no database clients or mutations belong in the visual components.
- Cancellation is confirmed separately and only uses the last saved snapshot; why: cancelling cannot silently edit other fields.
