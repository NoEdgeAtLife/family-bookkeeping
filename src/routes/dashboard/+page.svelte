<script>
    import { db } from "../../lib/firebase/firebase";
    import { authHandlers, authStore } from "../../store/store";
    import { getDoc, doc, setDoc } from "firebase/firestore";
    import AccountsList from "../../components/AccountsList.svelte";

    let accounts = [1];
    let accountName = "";
    let amount = "";
    let txs = [];

    authStore.subscribe((curr) => {
      if (curr.user) {
        accounts = Object.entries(curr.data.accounts);
        txs = Object.entries(curr.data.txs);
      }
    });

    let editAccount = (accountName, amount) => {
        accountName = accountName;
        amount = amount;
    };
    let deleteAccount = async (accountName) => {
        const docRef = doc(db, "users", $authStore.user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.data();
        delete data.accounts[accountName];
        await setDoc(docRef, data);
        accounts = Object.entries(data.accounts);
    };
    let addAccount = async () => {
        const docRef = doc(db, "users", $authStore.user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.data();
        data.accounts[accountName] = amount;
        await setDoc(docRef, data);
        accounts = Object.entries(data.accounts);
    };

    let fromAccount = "";
    let toAccount = "";
    let txAmount = "";
    let txDate = "";

    let addTransaction = async () => {
        const docRef = doc(db, "users", $authStore.user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.data();
        data.txs.push({
            from: fromAccount,
            to: toAccount,
            amount: txAmount,
            date: txDate
        });
        await setDoc(docRef, data);
        txs = Object.entries(data.txs);

        // Update the corresponding accounts
        data.accounts[fromAccount] -= txAmount;
        data.accounts[toAccount] += txAmount;
        await setDoc(docRef, data);
        accounts = Object.entries(data.accounts);
    };

    let deleteTransaction = async (index) => {
        const docRef = doc(db, "users", $authStore.user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.data();
        data.txs.splice(index, 1);
        await setDoc(docRef, data);
        txs = Object.entries(data.txs);

        // Update the corresponding accounts
        data.accounts[fromAccount] += txAmount;
        data.accounts[toAccount] -= txAmount;
        await setDoc(docRef, data);
        accounts = Object.entries(data.accounts);
    };
</script>

{#if !$authStore.loading}
<div class="mainContainer">
  <div class="headerContainer">
    <h1>Accounts</h1>
    <button on:click={() => authHandlers.logout()}>Sign Out</button>
  </div>
  <div class="formContainer">
    <input type="text" bind:value={accountName} placeholder="Account Name" />
    <input type="number" bind:value={amount} placeholder="Amount" />
    <button on:click={addAccount}>Add Account</button>
  </div>
  <main>
    {#if accounts.length > 0}
      <AccountsList {accounts} {editAccount} {deleteAccount} />
    {:else}
      <p>No accounts found</p>
    {/if}
  </main>
  <div class="transactionContainer">
    <h2>Transactions</h2>
    <div class="transactionForm">
      <select bind:value={fromAccount}>
        {#each accounts as [accountName, amount]}
          <option value={accountName}>{accountName}</option>
        {/each}
      </select>
      <select bind:value={toAccount}>
        {#each accounts as [accountName, amount]}
          <option value={accountName}>{accountName}</option>
        {/each}
      </select>
      <input type="number" bind:value={txAmount} placeholder="Amount" />
      <input type="date" bind:value={txDate} placeholder="Date" />
      <button on:click={addTransaction}>Add Transaction</button>
    </div>
    <div class="transactionList">
      {#if txs.length > 0}
        <ul>
          {#each txs as [index, tx]}
            <li key={index}>
              <p>From: {tx.from}</p>
              <p>To: {tx.to}</p>
              <p>Amount: {tx.amount}</p>
              <p>Date: {tx.date}</p>
              <button on:click={() => deleteTransaction(index)}>Delete</button>
            </li>
          {/each}
        </ul>
      {:else}
        <p>No transactions found</p>
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
  .mainContainer {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .headerContainer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 10px;
    border-bottom: 1px solid #000;
  }
  .formContainer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 10px;
    border-bottom: 1px solid #000;
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
  }
  .transactionForm {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  .transactionList {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  ul {
    list-style-type: none;
    padding: 0;
  }
  li {
    margin-bottom: 10px;
  }
</style>