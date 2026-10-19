import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './PesaFlow-overrides.css'

const STORAGE_KEY = 'pesaflow-transactions'

const expenseCategories = ['Food', 'Transport', 'Bills', 'Shopping', 'Other']
const incomeCategories = ['Salary', 'Business', 'Other']

// Dates are stored as ISO strings (YYYY-MM-DD) and only formatted for display.
const initialTransactions = [
  { id: 1, title: 'Monthly salary', category: 'Salary', date: '2026-10-01', amount: 2000000, type: 'income', icon: '💰' },
  { id: 2, title: 'Grocery shopping', category: 'Food', date: '2026-10-03', amount: 85000, type: 'expense', icon: '🛒' },
  { id: 3, title: 'Transport', category: 'Transport', date: '2026-10-05', amount: 25000, type: 'expense', icon: '🚕' },
  { id: 4, title: 'Internet bill', category: 'Bills', date: '2026-10-07', amount: 60000, type: 'expense', icon: '📶' },
]

const money = (amount) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('TZS', 'TSh')
    .replace(/\u00a0/g, ' ')

const compactNumber = (amount) =>
  new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)

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

const parseISODate = (iso) => new Date(`${iso}T12:00:00`)

const formatTransactionDate = (iso) => {
  const parsed = parseISODate(iso)

  if (Number.isNaN(parsed.getTime())) return iso

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

const formatDateForInput = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const loadTransactions = () => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)

    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // Storage unavailable or corrupted: fall back to the demo data.
  }

  return initialTransactions
}

const emptyForm = () => ({
  title: '',
  category: 'Food',
  date: formatDateForInput(),
  amount: '',
  type: 'expense',
})

function App() {
  const [transactions, setTransactions] = useState(loadTransactions)
  const [activePage, setActivePage] = useState('Dashboard')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [activeMonth, setActiveMonth] = useState(null)

  const profileRef = useRef(null)

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Save transactions so they survive a page refresh.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(transactions),
      )
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, [transactions])

  // Close menus and dialogs with the Escape key.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return

      setShowForm(false)
      setShowLogoutConfirm(false)
      setShowProfileMenu(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close the profile menu when clicking outside of it.
  useEffect(() => {
    if (!showProfileMenu) return undefined

    function handleClick(event) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showProfileMenu])

  // Hide the in-app notice automatically.
  useEffect(() => {
    if (!notice) return undefined

    const timer = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return b.id - a.id
      }),
    [transactions],
  )

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

  const filteredTransactions = sortedTransactions.filter((item) =>
    `${item.title} ${item.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  // The dashboard only shows the latest 5; the other pages show everything.
  const visibleTransactions =
    activePage === 'Dashboard'
      ? filteredTransactions.slice(0, 5)
      : filteredTransactions

  const monthlyChart = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(currentYear, currentMonth - 5 + index, 1)

      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        month: date.getMonth(),
        income: 0,
        expenses: 0,
      }
    })

    transactions.forEach((item) => {
      const parsed = parseISODate(item.date)

      if (Number.isNaN(parsed.getTime())) return

      const bucket = months.find(
        (month) =>
          month.year === parsed.getFullYear() &&
          month.month === parsed.getMonth(),
      )

      if (bucket) {
        const key = item.type === 'income' ? 'income' : 'expenses'
        bucket[key] += item.amount
      }
    })

    const max = Math.max(
      1,
      ...months.flatMap((month) => [month.income, month.expenses]),
    )

    return { months, max }
  }, [transactions, currentMonth, currentYear])

  const selectedMonth =
    monthlyChart.months.find((month) => month.key === activeMonth) ||
    monthlyChart.months[monthlyChart.months.length - 1]

  const categorySummary = useMemo(() => {
    const expenses = transactions.filter((item) => item.type === 'expense')

    const totalsByCategory = expenses.reduce((result, item) => {
      result[item.category] = (result[item.category] || 0) + item.amount
      return result
    }, {})

    const entries = Object.entries(totalsByCategory).sort(
      (a, b) => b[1] - a[1],
    )

    const total = entries.reduce((sum, [, amount]) => sum + amount, 0)

    const colors = [
      '#4385f5',
      '#54c6a0',
      '#f6a16b',
      '#9aaed0',
      '#9b8afc',
      '#e68aa8',
    ]

    const segments = entries.map(([category, amount], index) => {
      const percent = total > 0 ? (amount / total) * 100 : 0

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

    return { entries: segments, gradient, total }
  }, [transactions])

  const formCategories =
    form.type === 'income' ? incomeCategories : expenseCategories

  function changeFormType(type) {
    setForm((current) => ({
      ...current,
      type,
      category: type === 'income' ? 'Salary' : 'Food',
    }))
  }

  function openForm() {
    setForm(emptyForm())
    setShowForm(true)
  }

  function addTransaction(event) {
    event.preventDefault()

    const amount = Number(form.amount)

    if (
      !form.title.trim() ||
      !form.date ||
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
        date: form.date,
        amount,
        type: form.type,
        icon: form.type === 'income' ? '💵' : '💳',
      },
      ...current,
    ])

    setForm(emptyForm())
    setShowForm(false)
    setNotice('Transaction saved.')
  }

  function deleteTransaction(id) {
    setTransactions((current) => current.filter((item) => item.id !== id))
    setNotice('Transaction deleted.')
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
    setNotice(
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
          <span className="brand-icon">P</span>
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
              aria-current={activePage === item.name ? 'page' : undefined}
              onClick={() => setActivePage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}

              {item.name === 'Transactions' && (
                <span className="nav-count">{transactions.length}</span>
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

          <div className="profile" ref={profileRef}>
            <div className="avatar">P</div>

            <div className="profile-info">
              <strong>Pascal</strong>
              <span>Personal account</span>
            </div>

            <button
              className="profile-menu"
              aria-label="Open account menu"
              aria-expanded={showProfileMenu}
              onClick={() => setShowProfileMenu((open) => !open)}
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
            <span className="current-date">◷ &nbsp; {formatDate()}</span>
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

            <button className="primary-button" onClick={openForm}>
              <span>＋</span> Add transaction
            </button>
          </div>

          {notice && (
            <div className="toast" role="status">
              <span>{notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
              >
                ×
              </button>
            </div>
          )}

          {(activePage === 'Dashboard' || activePage === 'Reports') && (
            <>
              <section className="summary-grid">
                <article className="summary-card balance-card">
                  <div className="card-heading">
                    <span>Total balance</span>
                    <span className="summary-icon blue-icon">◈</span>
                  </div>

                  <h2>{money(totals.balance)}</h2>

                  <div className="card-foot">
                    <span className="status-dot blue-dot" />
                    Available balance
                  </div>

                  <div className="balance-decoration">P</div>
                </article>

                <article className="summary-card">
                  <div className="card-heading">
                    <span>Total income</span>
                    <span className="summary-icon green-icon">↙</span>
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
                    <span className="summary-icon orange-icon">↗</span>
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
                      <p>Income and expenses from your transactions</p>
                    </div>

                    <span className="period-pill">Last 6 months</span>
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

                  <div
                    className="bar-chart"
                    role="group"
                    aria-label="Income and expenses for the last six months"
                  >
                    <div className="bar-grid">
                      {[4, 3, 2, 1, 0].map((step) => (
                        <div className="bar-gridline" key={step}>
                          <span>
                            {compactNumber((monthlyChart.max * step) / 4)}
                          </span>
                          <i />
                        </div>
                      ))}
                    </div>

                    <div className="bar-columns">
                      {monthlyChart.months.map((month) => (
                        <button
                          type="button"
                          key={month.key}
                          className={`bar-column ${
                            selectedMonth.key === month.key ? 'active' : ''
                          }`}
                          aria-label={`${month.label} ${month.year}: income ${money(month.income)}, expenses ${money(month.expenses)}`}
                          onMouseEnter={() => setActiveMonth(month.key)}
                          onFocus={() => setActiveMonth(month.key)}
                          onClick={() => setActiveMonth(month.key)}
                        >
                          <div className="bar-pair">
                            <span
                              className="bar income-bar"
                              style={{
                                height: `${(month.income / monthlyChart.max) * 100}%`,
                              }}
                            />
                            <span
                              className="bar expense-bar"
                              style={{
                                height: `${(month.expenses / monthlyChart.max) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="bar-label">{month.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="chart-readout">
                    <strong>
                      {selectedMonth.label} {selectedMonth.year}
                    </strong>
                    <span className="readout-income">
                      Income {money(selectedMonth.income)}
                    </span>
                    <span className="readout-expense">
                      Expenses {money(selectedMonth.expenses)}
                    </span>
                    <span
                      className={
                        selectedMonth.income - selectedMonth.expenses >= 0
                          ? 'readout-net positive'
                          : 'readout-net negative'
                      }
                    >
                      Net {money(selectedMonth.income - selectedMonth.expenses)}
                    </span>
                  </div>

                  <p className="chart-note">
                    Based on the dates and amounts of your recorded
                    transactions. Months without entries show zero activity.
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
                      style={{ background: categorySummary.gradient }}
                    >
                      <div className="donut-center">
                        <span>Total spent</span>
                        <strong>{money(totals.expenses)}</strong>
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

                          <strong>{Math.round(item.percent)}%</strong>
                        </div>
                      ))
                    ) : (
                      <p>No expenses recorded yet.</p>
                    )}
                  </div>

                  <p className="chart-note">
                    Percentages are calculated from your recorded expenses.
                  </p>
                </article>
              </section>
            </>
          )}

          {activePage === 'Settings' && (
            <section className="panel settings-panel">
              <h3>Personal preferences</h3>
              <p>Welcome to your personal finance workspace, Pascal.</p>
              <p className="settings-note">
                Account preferences and currency options will be added in a
                future step.
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
                      : activePage === 'Dashboard'
                        ? 'Recent transactions'
                        : 'All transactions'}
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
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>

                  {activePage === 'Dashboard' && (
                    <button
                      className="text-button"
                      onClick={() => setActivePage('Transactions')}
                    >
                      View all ↗
                    </button>
                  )}
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
                      <th>
                        <span className="sr-only">ACTIONS</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleTransactions.map((item) => (
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
                          {formatTransactionDate(item.date)}
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
                          <span className={`type-pill ${item.type}`}>
                            {item.type}
                          </span>
                        </td>

                        <td>
                          <button
                            className="delete-button"
                            aria-label={`Delete ${item.title}`}
                            onClick={() => deleteTransaction(item.id)}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}

                    {visibleTransactions.length === 0 && (
                      <tr>
                        <td colSpan="6" className="empty-state">
                          No transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-footer">
                <span>
                  Showing {visibleTransactions.length} of{' '}
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
                Your current income, expenses and balance are calculated
                from your recorded transactions.
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
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
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
              <label className="form-label">Transaction type</label>

              <div className="type-selector">
                <button
                  type="button"
                  className={
                    form.type === 'expense' ? 'selected expense-select' : ''
                  }
                  onClick={() => changeFormType('expense')}
                >
                  ↗ Expense
                </button>

                <button
                  type="button"
                  className={
                    form.type === 'income' ? 'selected income-select' : ''
                  }
                  onClick={() => changeFormType('income')}
                >
                  ↙ Income
                </button>
              </div>

              <label className="form-label" htmlFor="transaction-name">
                Description
              </label>

              <input
                id="transaction-name"
                className="form-input"
                required
                autoFocus
                maxLength="80"
                placeholder="e.g. Lunch, salary..."
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />

              <label className="form-label" htmlFor="transaction-category">
                Category
              </label>

              <select
                id="transaction-category"
                className="form-input"
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                {formCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>

              <label className="form-label" htmlFor="transaction-date">
                Transaction date
              </label>

              <input
                id="transaction-date"
                className="form-input"
                type="date"
                required
                value={form.date}
                onChange={(event) =>
                  setForm({ ...form, date: event.target.value })
                }
              />

              <label className="form-label" htmlFor="transaction-amount">
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
                  setForm({ ...form, amount: event.target.value })
                }
              />

              <button className="primary-button modal-submit" type="submit">
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
              Your current session is only a local demo. Do you want to
              leave this demo screen?
            </p>

            <div className="logout-actions">
              <button
                className="secondary-button"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>

              <button className="primary-button" onClick={handleLogout}>
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