# gliding-weight-balance

Gliding Weight & Balance is a web application for preparing and validating glider loading before flight.

It helps pilots and operators:
- Define aircraft empty weight and arm values, CG limits, and wing area.
- Configure loading items (pilot, baggage, ballast, fuel/water ballast, and custom stations).
- Calculate total mass, CG position, wing loading, and balance status in real time.
- Visualize the loading point on a CG envelope chart, including guide lines and ideal ranges.
- Save and manage reusable loading profiles.

The app supports:
- English and French localization.
- Google sign-in (Identity Platform/Firebase Auth).
- User profile storage in Firestore when authenticated, with local default profile fallback when not signed in.