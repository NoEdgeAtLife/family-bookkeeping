<script>
    import { onMount } from "svelte"
    import { doc, getDoc, setDoc } from "firebase/firestore"
    import { auth, db } from "../lib/firebase/firebase.js"
    import { getAccounts, getTransactions } from "../lib/firebase/queries.js"
    import { authStore } from "../store/store.js"

    const nonAuthRoutes = ["/", "/product"]
    const initialTransactionsPageSize = 50
    const backgroundTransactionsPageSize = 250
    const loadTimeoutMs = 15000

    let activeLoadId = 0

    function withTimeout(promise, timeoutMs, errorMessage) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(errorMessage))
            }, timeoutMs)

            Promise.resolve(promise)
                .then((result) => {
                    clearTimeout(timeoutId)
                    resolve(result)
                })
                .catch((error) => {
                    clearTimeout(timeoutId)
                    reject(error)
                })
        })
    }

    function toAccountsObject(accounts = []) {
        return accounts.reduce((acc, account) => {
            if (!account?.name) {
                return acc
            }

            const parsedBalance = Number(account.balance)
            acc[account.name] = Number.isFinite(parsedBalance) ? parsedBalance : 0
            return acc
        }, {})
    }

    function toAccountIdMap(accounts = []) {
        return accounts.reduce((acc, account) => {
            if (!account?.name || !account?.id) {
                return acc
            }

            acc[account.name] = account.id
            return acc
        }, {})
    }

    function normalizeDateString(value) {
        if (!value) {
            return ""
        }

        const parsedDate = new Date(value)
        if (Number.isNaN(parsedDate.getTime())) {
            return String(value)
        }

        return parsedDate.toISOString().split("T")[0]
    }

    function normalizeTransaction(tx = {}) {
        const parsedAmount = Number(tx.amount)

        return {
            id: tx.id || "",
            from: tx.fromAccountName || tx.from || "",
            to: tx.toAccountName || tx.to || "",
            amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
            date: normalizeDateString(tx.date),
            description: tx.description || "",
            createdAt: tx.createdAt || tx.date || ""
        }
    }

    function normalizeTransactions(transactions = []) {
        return transactions.map((tx) => normalizeTransaction(tx))
    }

    async function hydrateUserData(user, baseData, loadId) {
        try {
            const [accounts, firstTransactionsPage] = await Promise.all([
                withTimeout(
                    getAccounts(user.uid),
                    loadTimeoutMs,
                    "Timed out loading accounts"
                ),
                withTimeout(
                    getTransactions(user.uid, initialTransactionsPageSize),
                    loadTimeoutMs,
                    "Timed out loading transactions"
                )
            ])

            if (loadId !== activeLoadId) {
                return
            }

            let transactions = normalizeTransactions(firstTransactionsPage.transactions)

            authStore.update((curr) => {
                return {
                    ...curr,
                    loading: false,
                    data: {
                        ...baseData,
                        accounts: toAccountsObject(accounts),
                        accountIds: toAccountIdMap(accounts),
                        transactions,
                        transactionsMeta: {
                            backgroundLoading: firstTransactionsPage.hasMore
                        }
                    }
                }
            })

            if (!firstTransactionsPage.hasMore) {
                return
            }

            let hasMore = firstTransactionsPage.hasMore
            let lastDoc = firstTransactionsPage.lastDoc

            while (hasMore && loadId === activeLoadId) {
                const nextPage = await withTimeout(
                    getTransactions(
                        user.uid,
                        backgroundTransactionsPageSize,
                        lastDoc
                    ),
                    loadTimeoutMs,
                    "Timed out loading more transactions"
                )

                const nextTransactions = normalizeTransactions(nextPage.transactions)
                transactions = [...transactions, ...nextTransactions]
                hasMore = nextPage.hasMore
                lastDoc = nextPage.lastDoc

                authStore.update((curr) => {
                    if (loadId !== activeLoadId) {
                        return curr
                    }

                    return {
                        ...curr,
                        data: {
                            ...curr.data,
                            transactions,
                            transactionsMeta: {
                                ...(curr.data?.transactionsMeta || {}),
                                backgroundLoading: hasMore
                            }
                        }
                    }
                })
            }

            authStore.update((curr) => {
                if (loadId !== activeLoadId) {
                    return curr
                }

                return {
                    ...curr,
                    data: {
                        ...curr.data,
                        transactionsMeta: {
                            ...(curr.data?.transactionsMeta || {}),
                            backgroundLoading: false
                        }
                    }
                }
            })
        } catch (error) {
            console.error("Failed to load user data", error)

            authStore.update((curr) => {
                if (loadId !== activeLoadId) {
                    return curr
                }

                return {
                    ...curr,
                    loading: false,
                    data: {
                        ...curr.data,
                        transactionsMeta: {
                            ...(curr.data?.transactionsMeta || {}),
                            backgroundLoading: false,
                            loadError: true,
                            loadErrorMessage: "Unable to load all data. Please refresh and try again."
                        }
                    }
                }
            })
        }
    }

    onMount(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            const currentPath = window.location.pathname
            let loadId = null

            try {
                if (!user && !nonAuthRoutes.includes(currentPath)) {
                    window.location.href = "/"
                    return
                }

                if (user && currentPath === "/") {
                    window.location.href = "/dashboard"
                    return
                }

                if (!user) {
                    authStore.update((curr) => {
                        return {
                            ...curr,
                            user: null,
                            data: {},
                            loading: false
                        }
                    })
                    return
                }

                loadId = ++activeLoadId
                const userRef = doc(db, "users", user.uid)

                authStore.update((curr) => {
                    return {
                        ...curr,
                        user,
                        loading: true,
                        data: {
                            ...(curr?.data || {}),
                            transactionsMeta: {
                                ...(curr?.data?.transactionsMeta || {}),
                                backgroundLoading: false,
                                loadError: false,
                                loadErrorMessage: ""
                            }
                        }
                    }
                })

                const userDoc = await withTimeout(
                    getDoc(userRef),
                    loadTimeoutMs,
                    "Timed out loading user profile"
                )

                let baseData
                if (!userDoc.exists()) {
                    baseData = {
                        email: user.email,
                        accounts: {},
                        accountIds: {},
                        transactions: []
                    }
                    await withTimeout(
                        setDoc(userRef, baseData, { merge: true }),
                        loadTimeoutMs,
                        "Timed out creating user profile"
                    )
                } else {
                    baseData = userDoc.data() || {}
                }

                const {
                    accounts: _ignoredAccounts,
                    txs: _ignoredLegacyTransactions,
                    accountIds: _ignoredAccountIds,
                    transactions: _ignoredTransactions,
                    transactionsMeta: _ignoredTransactionsMeta,
                    ...otherUserData
                } = baseData

                const hydratedBaseData = {
                    ...otherUserData,
                    email: otherUserData.email || user.email
                }

                authStore.update((curr) => {
                    return {
                        ...curr,
                        user,
                        loading: true,
                        data: {
                            ...hydratedBaseData,
                            accounts: {},
                            accountIds: {},
                            transactions: [],
                            transactionsMeta: {
                                backgroundLoading: false,
                                loadError: false,
                                loadErrorMessage: ""
                            }
                        }
                    }
                })

                await hydrateUserData(user, hydratedBaseData, loadId)
            } catch (error) {
                console.error("Auth bootstrap failed", error)

                authStore.update((curr) => {
                    if (loadId && loadId !== activeLoadId) {
                        return curr
                    }

                    return {
                        ...curr,
                        user: user || null,
                        loading: false,
                        data: {
                            ...(curr?.data || {}),
                            accounts: curr?.data?.accounts || {},
                            accountIds: curr?.data?.accountIds || {},
                            transactions: curr?.data?.transactions || [],
                            transactionsMeta: {
                                ...(curr?.data?.transactionsMeta || {}),
                                backgroundLoading: false,
                                loadError: true,
                                loadErrorMessage: "Unable to load your data. Please refresh and try again."
                            }
                        }
                    }
                })
            }
        })

        return () => {
            activeLoadId += 1
            unsubscribe()
        }
    })
</script>

<div class="mainContainer">
    <slot />
</div>

<style>
    .mainContainer {
        min-height: 100vh;
        background: linear-gradient(to right, #BBCDD3, #9fbec9);
        color: #333;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    }

    @media (max-width: 768px) {
        .mainContainer {
            padding: 20px;
        }
    }
</style>
