import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CostAnomalyBanner } from '../../components/CostAnomalyBanner'

describe('CostAnomalyBanner', () => {
  it('renders when anomalies exist and can be dismissed', () => {
    render(
      <CostAnomalyBanner
        anomalies={[
          { category: 'forge' },
          { category: 'oracle' },
        ]}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain('⚠️ 2 cost anomalies detected')
    expect(screen.getByText(/Affected agents: forge, oracle/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss anomalies alert' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not render when no anomalies exist', () => {
    const { container } = render(<CostAnomalyBanner anomalies={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
