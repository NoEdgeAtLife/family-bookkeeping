<script>
    import { db } from "../../lib/firebase/firebase";
    import { authHandlers, authStore } from "../../store/store";
    import { getDoc, doc, setDoc } from "firebase/firestore";
    import AccountsList from "../../components/AccountsList.svelte";
    import TransactionsList from "../../components/TransactionsList.svelte";

    let accounts = [];
    let accountName = "";
    let amount = "";
    let txs = [];
    authStore.subscribe((curr) => {
      if (curr.user) {
        accounts = Object.entries(curr.data.accounts);
        txs = Object.entries(curr.data.txs);
      }
    });

    let editAccount = async (accountName, amount) => {
      const docRef = doc(db, "users", $authStore.user.uid);
      const docSnap = await getDoc(docRef);
      let data = docSnap.data();
      data.accounts = {
        ...data.accounts,
        [accountName]: amount,
      };
      await setDoc(docRef, data);
      accounts = Object.entries(data.accounts);
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
        data.accounts = {
        ...data.accounts,
        [accountName]: amount,
        };
        await setDoc(docRef, data);
        accounts = Object.entries(data.accounts);
    };

    let fromAccount = "";
    let toAccount = "";
    let txAmount = "";
    let txDate = new Date().toISOString().split('T')[0];
    let txDescription = "";

    let addTransaction = async () => {
        const docRef = doc(db, "users", $authStore.user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.data();
        data.txs.push({
            from: fromAccount,
            to: toAccount,
            amount: txAmount,
            date: txDate,
            description: txDescription
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
        txAmount = data.txs[index].amount;
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
      <input type="date" bind:value={txDate} placeholder={txDate} />
      <input type="text" bind:value={txDescription} placeholder="Description" />
      <button on:click={addTransaction}>Add Transaction</button>
    </div>
    <div class="transactionList">
      {#if txs.length > 0}
      <TransactionsList {txs} {deleteTransaction} />
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
</style>