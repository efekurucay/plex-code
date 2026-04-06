/**
 * PlexCode Theme — Perplexity Brand Colors
 *
 * Off Black      #091717
 * Inky Blue      #153B39
 * Peacock        #2E5E5A
 * True Turquoise #20808D
 * Plex Blue      #2E5E5A
 * Sky            #67B8C0
 * Paper White    #FBFAF4
 * Ecru           #E4E3D4
 * Apricot        #FFD2A6
 * Terra Cotta    #A34B2F
 * Boysenberry    #944454
 */

export const theme = {
  // Backgrounds
  bg:          '#091717',
  bgSubtle:    '#0f1f1e',
  bgMuted:     '#153B39',
  bgAccent:    '#2E5E5A',

  // Primary palette
  primary:     '#20808D',
  primaryDim:  '#2E5E5A',
  sky:         '#67B8C0',

  // Text
  text:        '#FBFAF4',
  textDim:     '#E4E3D4',
  textMuted:   '#6b9e9b',

  // Semantic
  user:        '#FFD2A6',   // Apricot — user messages
  ai:          '#20808D',   // True Turquoise — AI messages
  error:       '#A34B2F',   // Terra Cotta
  warning:     '#FFD2A6',   // Apricot
  success:     '#20808D',

  // Borders
  border:      '#2E5E5A',
  borderFocus: '#20808D',

  // Special
  locked:      '#944454',   // Boysenberry — locked/Pro badge
} as const;
