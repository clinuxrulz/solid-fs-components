import { Match, Switch } from 'solid-js'
import { useIndentGuide } from '.'
import styles from './defaults.module.css'

export function DefaultIndentGuide(props: { color: string; width: number }) {
  const indentGuide = useIndentGuide()
  return (
    <span class={styles.container} style={{ '--color': props.color, width: `${props.width}px` }}>
      <Switch>
        <Match when={indentGuide() === 'elbow'}>
          <span class={styles.elbow} />
        </Match>
        <Match when={indentGuide() === 'tee'}>
          <span class={styles.pipe} />
          <span class={styles.arm} />
        </Match>
        <Match when={indentGuide() === 'pipe'}>
          <span class={styles.pipe} />
        </Match>
      </Switch>
    </span>
  )
}
