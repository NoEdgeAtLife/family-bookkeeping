<script>
    import { db } from "../../lib/firebase/firebase";
    import { authHandlers, authStore } from "../../store/store";
    import { getDoc, doc, setDoc } from "firebase/firestore";
    import AccountsList from "../../components/AccountsList.svelte";
    import TransactionsList from "../../components/TransactionsList.svelte";
    import Calculator from "../../components/Calculator.svelte";

    let accounts = [];
    let accountName = "";
    let amount = "";
    let txs = [];
    const normalizeAccounts = (accountsData) => {
      if (!accountsData) {
        return {};
      }
      if (Array.isArray(accountsData)) {
        return accountsData.reduce((acc, entry) => {
          if (Array.isArray(entry) && entry.length >= 2) {
            acc[entry[0]] = entry[1];
          }
          return acc;
        }, {});
      }
      if (typeof accountsData === "object") {
        return Object.entries(accountsData).reduce((acc, [key, value]) => {
          if (!Number.isFinite(Number(key))) {
            acc[key] = value;
          }
          return acc;
        }, {});
      }
      return {};
    };
    const sortAccounts = (entries = []) =>
      entries.slice().sort((a, b) => a[0].localeCompare(b[0]));
    const sortTransactions = (entries = []) =>
      entries
        .slice()
        .sort((a, b) => {
          const dateDiff = new Date(b[1].date) - new Date(a[1].date);
          if (dateDiff !== 0) {
            return dateDiff;
          }
          const aCreated = a[1].createdAt ? new Date(a[1].createdAt) : new Date(a[1].date);
          const bCreated = b[1].createdAt ? new Date(b[1].createdAt) : new Date(b[1].date);
          return bCreated - aCreated;
        });
    authStore.subscribe((curr) => {
      if (curr.user) {
        const normalizedAccounts = normalizeAccounts(curr.data.accounts);
        accounts = sortAccounts(Object.entries(normalizedAccounts));
        txs = sortTransactions(Object.entries(curr.data.txs));
      }
    });

    let editAccount = async (accountName, nextName, amount) => {
      const docRef = doc(db, "users", $authStore.user.uid);
      const docSnap = await getDoc(docRef);
      let data = docSnap.data();
      data.accounts = normalizeAccounts(data.accounts);
      const trimmedName = (nextName || accountName || "").trim();
      if (!trimmedName) {
        return;
      }
      const amountValue = parseFloat(amount);
      if (isNaN(amountValue)) {
        return;
      }
      if (trimmedName !== accountName) {
        delete data.accounts[accountName];
        if (Array.isArray(data.txs)) {
          data.txs = data.txs.map((tx) => {
            const nextTx = { ...tx };
            if (nextTx.from === accountName) {
              nextTx.from = trimmedName;
            }
            if (nextTx.to === accountName) {
              nextTx.to = trimmedName;
            }
            return nextTx;
          });
        }
      }
      data.accounts = {
        ...data.accounts,
        [trimmedName]: amountValue,
      };
      await setDoc(docRef, data);
      accounts = sortAccounts(Object.entries(data.accounts));
    };

    let deleteAccount = async (accountName) => {
        const docRef = doc(db, "users", $authStore.user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.data();
        data.accounts = normalizeAccounts(data.accounts);
        delete data.accounts[accountName];
        await setDoc(docRef, data);
    accounts = sortAccounts(Object.entries(data.accounts));
    };
    let addAccount = async () => {
        const docRef = doc(db, "users", $authStore.user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.data();
    data.accounts = normalizeAccounts(data.accounts);
        data.accounts = {
        ...data.accounts,
        [accountName]: amount,
        };
        await setDoc(docRef, data);
    accounts = sortAccounts(Object.entries(data.accounts));
    };

    let fromAccount = "";
    let toAccount = "";
    let txAmount = "";
    let txDate = new Date().toISOString().split('T')[0];
    let txDescription = "";
  let txSubmitting = false;
  let txStatus = "";
  let txError = "";
  let lastTxPayload = null;
    let dismissTxStatus = () => {
      txStatus = "";
      txError = "";
    };

    let submitTransaction = async (payload) => {
      const { from, to, amount, date, description } = payload;
      // Check if amounts are valid
      if (isNaN(amount) || isNaN(parseFloat(amount))) {
        txError = "Invalid amount";
        return;
      }
      if (!from || !to) {
        txError = "Please select both accounts";
        return;
      }

      txSubmitting = true;
      txStatus = "Adding transaction...";
      txError = "";

      const docRef = doc(db, "users", $authStore.user.uid);
      const docSnap = await getDoc(docRef);
      let data = docSnap.data();
      data.accounts = normalizeAccounts(data.accounts);
      data.txs.push({
        from,
        to,
        amount,
        date,
        description,
        createdAt: new Date().toISOString(),
      });
      // Update the corresponding accounts
      const amountValue = parseFloat(amount);
      data.accounts[from] -= amountValue;
      data.accounts[to] += amountValue;

      await setDoc(docRef, data);
  txs = sortTransactions(Object.entries(data.txs));
      accounts = sortAccounts(Object.entries(data.accounts));
      txStatus = "Transaction added";
    };

    let addTransaction = async () => {
      const payload = {
        from: fromAccount,
        to: toAccount,
        amount: txAmount,
        date: txDate,
        description: txDescription,
      };
      lastTxPayload = payload;
      try {
        await submitTransaction(payload);
        // Clear the input fields after successful add
        txAmount = "";
        txDescription = "";
      } catch (error) {
        console.error(error);
        txError = "Failed to add transaction. Please retry.";
      } finally {
        txSubmitting = false;
      }
    };

    let retryAddTransaction = async () => {
      if (!lastTxPayload) {
        return;
      }
      try {
        await submitTransaction(lastTxPayload);
      } catch (error) {
        console.error(error);
        txError = "Retry failed. Please try again.";
      } finally {
        txSubmitting = false;
      }
    };

    let editTransaction = async (index, updatedTx) => {
        const docRef = doc(db, "users", $authStore.user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.data();
        data.accounts = normalizeAccounts(data.accounts);
        const currentTx = data.txs[index];
        if (!currentTx) {
          return;
        }
        const nextAmount = parseFloat(updatedTx.amount);
        if (isNaN(nextAmount)) {
          return;
        }
        const prevAmount = parseFloat(currentTx.amount);
        if (isNaN(prevAmount)) {
          return;
        }
        const nextFrom = updatedTx.from || currentTx.from;
        const nextTo = updatedTx.to || currentTx.to;

        // Roll back previous transaction impact
        data.accounts[currentTx.from] += prevAmount;
        data.accounts[currentTx.to] -= prevAmount;

        // Apply updated transaction impact
        data.accounts[nextFrom] -= nextAmount;
        data.accounts[nextTo] += nextAmount;

        data.txs[index] = {
          ...currentTx,
          ...updatedTx,
          from: nextFrom,
          to: nextTo,
          amount: nextAmount,
          createdAt: currentTx.createdAt || updatedTx.createdAt || currentTx.date,
        };
        await setDoc(docRef, data);
        txs = sortTransactions(Object.entries(data.txs));
    accounts = sortAccounts(Object.entries(data.accounts));
    };

    let deleteTransaction = async (index, tx) => {
        const docRef = doc(db, "users", $authStore.user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.data();
  data.accounts = normalizeAccounts(data.accounts);
        txAmount = tx.amount;
        fromAccount = tx.from;
        toAccount = tx.to;
        data.txs.splice(index, 1);
  txs = sortTransactions(Object.entries(data.txs));

        // Update the corresponding accounts
        data.accounts[fromAccount] += txAmount;
        data.accounts[toAccount] -= txAmount;

        await setDoc(docRef, data);
    accounts = sortAccounts(Object.entries(data.accounts));
    };
</script>

{#if !$authStore.loading}
  <div class="mainContainer">
    <div class="signoutContainer">
      <button on:click={() => authHandlers.logout()}>Sign Out</button>
    </div>
    <Calculator {accounts} />
  <div class="headerContainer">
    <h1>Accounts</h1>
  </div>
  <div class="formContainer">
    <input type="text" bind:value={accountName} placeholder="Account Name" />
    <input type="number" bind:value={amount} placeholder="$" />
    <button on:click={addAccount}>Add Account</button>
  </div>

  <main>
    {#if accounts.length > 0}
      <AccountsList {accounts} {editAccount} {deleteAccount} />
    {:else}
      <p>No accounts found</p>
    {/if}
  <div class="transactionContainer">
    <h2>Transactions</h2>
    <div class="transactionForm">
      <div class="tf-row tf-accounts">
        <select bind:value={fromAccount}>
          <option value="">From account</option>
          {#each accounts as [accountName, amount]}
            <option value={accountName}>{accountName}</option>
          {/each}
        </select>
        <select bind:value={toAccount}>
          <option value="">To account</option>
          {#each accounts as [accountName, amount]}
            <option value={accountName}>{accountName}</option>
          {/each}
        </select>
      </div>
      <div class="tf-row tf-amount-desc">
        <input type="number" bind:value={txAmount} placeholder="$" />
        <input type="text" bind:value={txDescription} placeholder="Description" />
      </div>
      <div class="tf-row tf-date-add">
        <input type="date" bind:value={txDate} placeholder={txDate} />
        <button class="icon add" on:click={addTransaction} disabled={txSubmitting} aria-label="Add transaction">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
    {#if txStatus || txError}
      <div class="txStatus" aria-live="polite">
        {#if txStatus}
          <span class="success">{txStatus}</span>
        {/if}
        {#if txError}
          <span class="error">{txError}</span>
          <button class="retry" on:click={retryAddTransaction} disabled={txSubmitting}>Retry</button>
        {/if}
        <button class="dismiss" on:click={dismissTxStatus} aria-label="Dismiss">✕</button>
      </div>
    {/if}
    <div class="transactionList">
      {#if txs.length > 0}
  <TransactionsList {txs} {accounts} {editTransaction} {deleteTransaction} />
      {:else}
        <p>No transactions found</p>
      {/if}
    </div>
  </div>
  </main>
</div>
{/if}

<style>
  .mainContainer {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
  }
  .headerContainer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 10px;
    gap: 10px;
    position: relative;
  }
  .headerContainer h1 {
    font-size: 1.5rem;
    margin: 0;
  }
  .signoutContainer {
    width: 100%;
    display: flex;
    justify-content: flex-start;
    padding: 8px 0 0 0;
  }
  .signoutContainer button {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 6px 12px;
    min-height: 36px;
    border-radius: 6px;
    background-color: #007bff;
    color: #fff;
    border: none;
    cursor: pointer;
  }
  .formContainer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 10px;
    gap: 10px;
  }
  .formContainer input {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    min-height: 36px;
    border-radius: 6px;
    border: 1px solid #e6e9ee;
    box-shadow: inset 0 1px 2px rgba(16,24,40,0.03);
  }
  .formContainer button {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 6px 12px;
    min-height: 36px;
    border-radius: 6px;
    background-color: #007bff;
    color: #fff;
  }
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 10px;
  }
  p {
    margin: 10px 0;
  }
  .transactionContainer {
    margin-top: 20px;
    width: 100%;
  }
  .transactionContainer h2 {
    font-size: 1.25rem;
    margin-bottom: 10px;
  }
  .transactionForm {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
    align-items: flex-start;
  }
  .transactionForm .tf-row {
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .transactionForm .tf-row > * {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    min-height: 36px;
    border-radius: 6px;
    border: 1px solid #e6e9ee;
    box-shadow: inset 0 1px 2px rgba(16,24,40,0.03);
  }
  .transactionForm .tf-row .add {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: #007bff;
    color: #fff;
    border: none;
    padding: 0;
  }
  .transactionForm .tf-row .add:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .txStatus {
    display: flex;
    gap: 10px;
    align-items: center;
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10;
    padding: 8px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(6px);
    max-width: calc(100vw - 40px);
  }
  .txStatus .success {
    color: #1a7f37;
    font-weight: 600;
  }
  .txStatus .error {
    color: #b42318;
    font-weight: 600;
  }
  .txStatus .retry {
    border: 1px solid #b42318;
    background: transparent;
    color: #b42318;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    min-height: 44px;
  }
  .txStatus .dismiss {
    border: none;
    background: transparent;
    color: #333;
    cursor: pointer;
    font-size: 14px;
    min-width: 44px;
    min-height: 44px;
  }

  @media (max-width: 768px) {
    .headerContainer h1 {
      font-size: 1.25rem;
    }
    .formContainer {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 0 6px;
    }
    .formContainer input {
      flex: 1 1 auto;
      margin-bottom: 0;
      min-width: 0;
    }
    .formContainer button {
      flex: 0 0 auto;
      width: auto;
      margin-bottom: 0;
      padding: 6px 10px;
    }
    .transactionForm {
      flex-direction: column;
      gap: 6px;
    }
    .transactionForm .tf-row {
      flex-direction: row;
    }
    .transactionForm .tf-accounts > *,
    .transactionForm .tf-amount-desc > * {
      flex: 1 1 50%;
    }
    .transactionForm .tf-date-add > input {
      flex: 1 1 auto;
    }
    .transactionForm .tf-date-add .add {
      margin-left: 8px;
    }
    .txStatus {
      flex-direction: column;
      align-items: stretch;
      left: 20px;
      right: 20px;
      bottom: 10px;
    }
  }
</style>