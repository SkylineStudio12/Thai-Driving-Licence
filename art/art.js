/* Artwork manifest: slot name -> file in art/. One file can serve several slots.
   Any slot not listed shows a tinted Lucide icon instead.
   Slots: onboarding, goal, continue, theory-hero, mock, result-pass, result-fail,
          practice-theory, practice-signs, group-<signs|law|riding|health>,
          cat-<veh|trf|sign|mark|alco|fit|aid|etq|safe|maint|moto|proc>, car, moto, van, truck */
const ART = {
  car:   'car.webp',
  moto:  'moto.webp',
  van:   'van.webp',
  truck: 'truck.webp',
  onboarding:        'licence.webp',
  mock:              'certificate.webp',
  'result-pass':     'clipboard.webp',
  'result-fail':     'clipboard-fail.webp',
  'practice-theory': 'books.webp',
  'practice-signs':  'stop-sign.webp',
  'theory-hero':     'signs.webp',
  continue:          'bridge.webp',
  'group-signs':     'traffic-light.webp',
  'group-law':       'crossroads.webp',
  'group-riding':    'steering-wheel.webp',
  'group-health':    'theory-book.webp',
  'cat-sign':        'stop-sign.webp',
  'cat-mark':        'bridge.webp',
  'cat-trf':         'crossroads.webp',
  'cat-veh':         'warden.webp',
  'cat-etq':         'storm.webp',
  'cat-safe':        'helmet.webp',
  'cat-proc':        'documents.webp',
  'cat-alco':        'alcohol.webp',
  'cat-fit':         'helmet-check.webp',
  'cat-aid':         'first-aid.webp',
  'cat-maint':       'tools.webp',
  goal:              'calendar-goal.webp',
  avatar:            'user.webp',
  'cat-moto':        'moto.webp'
};
/* stored for later screens (e.g. hazard clips), not used yet */
const UNUSED = ['video.webp', 'camera.webp'];
