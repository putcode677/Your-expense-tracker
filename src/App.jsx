
import { useMemo, useState } from 'react'
import './App.css'
import './PesaFlow-overrides.css'

const initialTransactions = [
  { id: 1, title: 'Monthly salary', category: 'Salary', date: 'Oct 01, 2026', amount: 2000000, type: 'income', icon: '💰' },
  { id: 2, title: 'Grocery shopping', category: 'Food', date: 'Oct 03, 2026', amount: 85000, type: 'expense', icon: '🛒' },
  { id: 3, title: 'Transport', category: 'Transport', date: 'Oct 05, 2026', amount: 25000, type: 'expense', icon: '🚕' },
  { id: 4, title: 'Internet bill', category: 'Bills', date: 'Oct 07, 2026', amount: 60000, type: 'expense', icon: '📶' },
]

const money = (amount) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(amount).replace('TZS', 'TSh')

const getGreeting = (date = new Date()) => {
  const hour = date.getHours()

  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 21) return 'Good evening'

  return 'Good night'
}

const formatDate = (date = new Date()) =>
  date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

const formatTransactionDate = (date = new Date()) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })

function App() {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [activePage, setActivePage] = useState('Dashboard')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const [form, setForm] = useState({
    title: '',
    category: 'Food',
    amount: '',
    type: 'expense',
  })

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const totals = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0)

    const expenses = transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0)

    return {
      income,
      expenses,
      balance: income - expenses,
    }
  }, [transactions])

  const filteredTransactions = transactions.filter((item) =>
    `${item.title} ${item.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  const monthlyChart = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(
        currentYear,
        currentMonth - 5 + index,
        1,
      )

      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('en-US', {
          month: 'short',
        }),
        year: date.getFullYear(),
        month: date.getMonth(),
        income: 0,
        expenses: 0,
      }
    })

    transactions.forEach((item) => {
      const parsed = new Date(item.date)

      if (Number.isNaN(parsed.getTime())) return

      const bucket = months.find(
        (month) =>
          month.year === parsed.getFullYear() &&
          month.month === parsed.getMonth(),
      )

      if (bucket) {
        const key =
          item.type === 'income' ? 'income' : 'expenses'

        bucket[key] += item.amount
      }
    })

    const max = Math.max(
      1,
      ...months.flatMap((month) => [
        month.income,
        month.expenses,
      ]),
    )

    const points = (key) =>
      months.map((month, index) => {
        const x =
          months.length === 1
            ? 300
            : index * (600 / (months.length - 1))

        const y = 170 - (month[key] / max) * 145

        return { x, y }
      })

    const path = (key) =>
      points(key)
        .map(
          (point, index) =>
            `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`,
        )
        .join(' ')

    return {
      months,
      max,
      incomePath: path('income'),
      expensePath: path('expenses'),
    }
  }, [transactions, currentMonth, currentYear])

  // Calculate expense categories without mutating render-time variables.
  const categorySummary = useMemo(() => {
    const expenses = transactions.filter(
      (item) => item.type === 'expense',
    )

    const totalsByCategory = expenses.reduce((result, item) => {
      result[item.category] =
        (result[item.category] || 0) + item.amount

      return result
    }, {})

    const entries = Object.entries(totalsByCategory).sort(
      (a, b) => b[1] - a[1],
    )

    const total = entries.reduce(
      (sum, [, amount]) => sum + amount,
      0,
    )

    const colors = [
      '#4385f5',
      '#54c6a0',
      '#f6a16b',
      '#9aaed0',
      '#9b8afc',
      '#e68aa8',
    ]

    const segments = entries.map(([category, amount], index) => {
      const percent =
        total > 0 ? (amount / total) * 100 : 0

      const offset =
        total > 0
          ? entries
              .slice(0, index)
              .reduce(
                (sum, [, previousAmount]) =>
                  sum + (previousAmount / total) * 100,
                0,
              )
          : 0

      return {
        category,
        amount,
        percent,
        color: colors[index % colors.length],
        offset,
      }
    })

    const gradient = segments.length
      ? `conic-gradient(${segments
          .map(
            (segment) =>
              `${segment.color} ${segment.offset}% ${segment.offset + segment.percent}%`,
          )
          .join(', ')})`
      : 'conic-gradient(#d7e2f3 0% 100%)'

    return {
      entries: segments,
      gradient,
      total,
    }
  }, [transactions])

  function addTransaction(event) {
    event.preventDefault()

    const amount = Number(form.amount)

    if (
      !form.title.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return
    }

    setTransactions((current) => [
      {
        id: Date.now(),
        title: form.title.trim(),
        category: form.category,
        date: formatTransactionDate(),
        amount,
        type: form.type,
        icon: form.type === 'income' ? '💵' : '💳',
      },
      ...current,
    ])

    setForm({
      title: '',
      category: 'Food',
      amount: '',
      type: 'expense',
    })

    setShowForm(false)
  }

  const navigation = [
    { name: 'Dashboard', icon: '▦' },
    { name: 'Transactions', icon: '↔' },
    { name: 'Reports', icon: '▥' },
    { name: 'Receipts', icon: '▤' },
    { name: 'Settings', icon: '⚙' },
  ]

  function handleLogout() {
    setShowLogoutConfirm(false)
    setShowProfileMenu(false)
    setActivePage('Dashboard')
    setSearch('')

    window.alert(
      'You have left this PesaFlow demo. Real account sign-out will be added when authentication is connected.',
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#dashboard"
          onClick={() => setActivePage('Dashboard')}
        >
          <span className="brand-icon">₮</span>
          <span>
            Pesa<span className="brand-light">Flow</span>
          </span>
        </a>

        <p className="nav-label">WORKSPACE</p>

        <nav className="navigation">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activePage === item.name ? 'active' : ''
              }`}
              onClick={() => setActivePage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}

              {item.name === 'Transactions' && (
                <span className="nav-count">
                  {transactions.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">✦</span>
            <strong>Manage your money</strong>
            <p>Small steps lead to big financial goals.</p>
          </div>

          <div className="profile">
            <div className="avatar">P</div>

            <div className="profile-info">
              <strong>Pascal</strong>
              <span>Personal account</span>
            </div>

            <button
              className="profile-menu"
              aria-label="Open account menu"
              aria-expanded={showProfileMenu}
              onClick={() =>
                setShowProfileMenu((open) => !open)
              }
            >
              •••
            </button>

            {showProfileMenu && (
              <div className="profile-dropdown">
                <strong>Pascal</strong>
                <span>Personal account</span>

                <button
                  onClick={() => {
                    setShowProfileMenu(false)
                    setShowLogoutConfirm(true)
                  }}
                >
                  ↪ Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activePage}
          </div>

          <div className="topbar-right">
            <span className="current-date">
              ◷ &nbsp; {formatDate()}
            </span>

            <button
              className="icon-button"
              aria-label="Account menu"
              aria-expanded={showProfileMenu}
              onClick={() =>
                setShowProfileMenu((open) => !open)
              }
            >
              ♧
            </button>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">YOUR FINANCIAL SPACE</p>

              <h1>
                {activePage === 'Dashboard'
                  ? `${getGreeting()}, Pascal`
                  : activePage}
              </h1>

              <p className="subtitle">
                {activePage === 'Dashboard'
                  ? 'Here is what is happening with your money.'
                  : `Manage and review your ${activePage.toLowerCase()}.`}
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => setShowForm(true)}
            >
              <span>＋</span> Add transaction
            </button>
          </div>

          {(activePage === 'Dashboard' ||
            activePage === 'Reports') && (
            <>
              <section className="summary-grid">
                <article className="summary-card balance-card">
                  <div className="card-heading">
                    <span>Total balance</span>
                    <span className="summary-icon blue-icon">
                      ◈
                    </span>
                  </div>

                  <h2>{money(totals.balance)}</h2>

                  <div className="card-foot">
                    <span className="status-dot blue-dot" />
                    Available balance
                  </div>

                  <div className="balance-decoration">₮</div>
                </article>

                <article className="summary-card">
                  <div className="card-heading">
                    <span>Total income</span>
                    <span className="summary-icon green-icon">
                      ↙
                    </span>
                  </div>

                  <h2>{money(totals.income)}</h2>

                  <div className="card-foot">
                    <span className="status-dot green-dot" />
                    Money received
                  </div>

                  <div className="mini-bars income-bars">
                    <i /><i /><i /><i /><i /><i /><i />
                  </div>
                </article>

                <article className="summary-card">
                  <div className="card-heading">
                    <span>Total expenses</span>
                    <span className="summary-icon orange-icon">
                      ↗
                    </span>
                  </div>

                  <h2>{money(totals.expenses)}</h2>

                  <div className="card-foot">
                    <span className="status-dot orange-dot" />
                    Money spent
                  </div>

                  <div className="mini-bars expense-bars">
                    <i /><i /><i /><i /><i /><i /><i />
                  </div>
                </article>
              </section>

              <section className="analytics-grid">
                <article className="panel spending-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Spending overview</h3>
                      <p>
                        Income and expenses from your transactions
                      </p>
                    </div>

                    <span className="period-pill">
                      Last 6 months
                    </span>
                  </div>

                  <div className="chart-legend">
                    <span>
                      <i className="legend-dot income-legend" />
                      Income
                    </span>

                    <span>
                      <i className="legend-dot expense-legend" />
                      Expenses
                    </span>
                  </div>

                  <div className="chart-area">
                    {[0, 1, 2, 3, 4].map((value) => (
                      <div
                        className="chart-gridline"
                        key={value}
                      >
                        <span>
                          {money(
                            (monthlyChart.max * (4 - value)) / 4,
                          ).replace('TSh ', '')}
                        </span>
                        <i />
                      </div>
                    ))}

                    <svg
                      className="line-chart"
                      viewBox="0 0 600 190"
                      preserveAspectRatio="none"
                      role="img"
                      aria-label="Income and expense totals for the last six months"
                    >
                      <path
                        d={`${monthlyChart.incomePath} L600 190 L0 190 Z`}
                        fill="url(#incomeFill)"
                      />

                      <defs>
                        <linearGradient
                          id="incomeFill"
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#4385f5"
                            stopOpacity=".20"
                          />
                          <stop
                            offset="100%"
                            stopColor="#4385f5"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>

                      <path
                        d={monthlyChart.incomePath}
                        fill="none"
                        stroke="#4385f5"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <path
                        d={monthlyChart.expensePath}
                        fill="none"
                        stroke="#54c6a0"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div className="chart-months">
                    {monthlyChart.months.map((month) => (
                      <span key={month.key}>
                        {month.label}
                      </span>
                    ))}
                  </div>

                  <p className="chart-note">
                    Based on the dates and amounts of your recorded
                    transactions. Months without entries show zero
                    activity.
                  </p>
                </article>

                <article className="panel category-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Expense summary</h3>
                      <p>Where your money goes</p>
                    </div>

                    <span className="more-button">•••</span>
                  </div>

                  <div className="donut-wrap">
                    <div
                      className="donut-chart"
                      style={{
                        background: categorySummary.gradient,
                      }}
                    >
                      <div className="donut-center">
                        <span>Total spent</span>
                        <strong>
                          {money(totals.expenses)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="category-list">
                    {categorySummary.entries.length ? (
                      categorySummary.entries.map((item) => (
                        <div key={item.category}>
                          <span>
                            <i
                              className="category-color"
                              style={{ background: item.color }}
                            />
                            {item.category}
                          </span>

                          <strong>
                            {Math.round(item.percent)}%
                          </strong>
                        </div>
                      ))
                    ) : (
                      <p>No expenses recorded yet.</p>
                    )}
                  </div>

                  <p className="chart-note">
                    Percentages are calculated from your recorded
                    expenses.
                  </p>
                </article>
              </section>
            </>
          )}

          {activePage === 'Settings' && (
            <section className="panel settings-panel">
              <h3>Personal preferences</h3>
              <p>
                Welcome to your personal finance workspace, Pascal.
              </p>
              <p className="settings-note">
                Account preferences and currency options will be
                added in a future step.
              </p>

              <button
                className="logout-settings-button"
                onClick={() => setShowLogoutConfirm(true)}
              >
                ↪ Log out
              </button>
            </section>
          )}

          {(activePage === 'Dashboard' ||
            activePage === 'Transactions' ||
            activePage === 'Receipts') && (
            <section className="panel transactions-panel">
              <div className="panel-heading transactions-heading">
                <div>
                  <h3>
                    {activePage === 'Receipts'
                      ? 'Receipt-ready transactions'
                      : 'Recent transactions'}
                  </h3>

                  <p>
                    {activePage === 'Receipts'
                      ? 'Choose a transaction to prepare its receipt later.'
                      : 'Keep track of your latest money movements'}
                  </p>
                </div>

                <div className="transaction-actions">
                  <label className="search-box">
                    <span>⌕</span>

                    <input
                      aria-label="Search transactions"
                      placeholder="Search..."
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                    />
                  </label>

                  <button
                    className="text-button"
                    onClick={() => setActivePage('Transactions')}
                  >
                    View all ↗
                  </button>
                </div>
              </div>

              <div className="transaction-table-wrap">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>TRANSACTION</th>
                      <th>CATEGORY</th>
                      <th>DATE</th>
                      <th>AMOUNT</th>
                      <th>TYPE</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTransactions.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="transaction-name">
                            <span className="transaction-icon">
                              {item.icon}
                            </span>
                            <strong>{item.title}</strong>
                          </div>
                        </td>

                        <td>
                          <span className="category-pill">
                            {item.category}
                          </span>
                        </td>

                        <td className="date-cell">
                          {item.date}
                        </td>

                        <td
                          className={
                            item.type === 'income'
                              ? 'amount-income'
                              : 'amount-expense'
                          }
                        >
                          {item.type === 'income' ? '+' : '−'}
                          {money(item.amount)}
                        </td>

                        <td>
                          <span
                            className={`type-pill ${item.type}`}
                          >
                            {item.type}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty-state">
                          No transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-footer">
                <span>
                  Showing {filteredTransactions.length} of{' '}
                  {transactions.length} transactions
                </span>

                <span className="secure-note">
                  ✦ Your personal finance space
                </span>
              </div>
            </section>
          )}

          {activePage === 'Reports' && (
            <section className="panel report-note">
              <h3>Monthly report</h3>
              <p>
                Your current income, expenses and balance are
                calculated from the transactions above.
              </p>
            </section>
          )}
        </section>

        <footer className="page-footer">
          <span>© {new Date().getFullYear()} PesaFlow</span>
          <span>
            Built for better money habits <b>♥</b>
          </span>
        </footer>
      </main>

      {showForm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowForm(false)}
        >
          <section
            className="transaction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">MONEY MOVEMENT</p>
                <h2 id="transaction-title">Add transaction</h2>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={addTransaction}>
              <label className="form-label">
                Transaction type
              </label>

              <div className="type-selector">
                <button
                  type="button"
                  className={
                    form.type === 'expense'
                      ? 'selected expense-select'
                      : ''
                  }
                  onClick={() =>
                    setForm({ ...form, type: 'expense' })
                  }
                >
                  ↗ Expense
                </button>

                <button
                  type="button"
                  className={
                    form.type === 'income'
                      ? 'selected income-select'
                      : ''
                  }
                  onClick={() =>
                    setForm({ ...form, type: 'income' })
                  }
                >
                  ↙ Income
                </button>
              </div>

              <label
                className="form-label"
                htmlFor="transaction-name"
              >
                Description
              </label>

              <input
                id="transaction-name"
                className="form-input"
                required
                maxLength="80"
                placeholder="e.g. Lunch, salary..."
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />

              <label
                className="form-label"
                htmlFor="transaction-category"
              >
                Category
              </label>

              <select
                id="transaction-category"
                className="form-input"
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value,
                  })
                }
              >
                {[
                  'Food',
                  'Transport',
                  'Bills',
                  'Shopping',
                  'Salary',
                  'Business',
                  'Other',
                ].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>

              <label
                className="form-label"
                htmlFor="transaction-amount"
              >
                Amount (TSh)
              </label>

              <input
                id="transaction-amount"
                className="form-input"
                required
                min="1"
                step="1"
                type="number"
                placeholder="Enter amount"
                value={form.amount}
                onChange={(event) =>
                  setForm({
                    ...form,
                    amount: event.target.value,
                  })
                }
              />

              <button
                className="primary-button modal-submit"
                type="submit"
              >
                Save transaction
              </button>
            </form>
          </section>
        </div>
      )}

      {showLogoutConfirm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <section
            className="transaction-modal logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">ACCOUNT</p>
                <h2 id="logout-title">Log out of PesaFlow?</h2>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowLogoutConfirm(false)}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <p>
              Your current session is only a local demo. Do you
              want to leave this demo screen?
            </p>

            <div className="logout-actions">
              <button
                className="secondary-button"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={handleLogout}
              >
                Yes, log out
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
