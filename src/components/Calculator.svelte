<script>
    export let accounts;
    let selectedAccount1;
    let selectedAccount2;
    let percentage = 0;
    let transactionAmount;
    let accountName1;
    let accountName2;

    function calculateTransactionAmount() {
        const account1 = accounts[selectedAccount1];
        const account2 = accounts[selectedAccount2];
        const totalAmount = account1[1] + account2[1];
        transactionAmount = (totalAmount * percentage) / 100 - account1[1]; // access the amount using the index
        accountName1 = account1[0];
        accountName2 = account2[0];
    }
</script>

<style>
    h1 {
        color: #333;
        font-size: 1.5rem;
        margin-bottom: 16px;
        text-align: center;
    }

    h2 {
        color: #333;
        font-size: 1.125rem;
        margin-bottom: 8px;
    }

    select {
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-bottom: 16px;
        width: 100%;
        min-height: 44px;
    }

    input[type="number"] {
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-bottom: 16px;
        width: 100%;
        min-height: 44px;
    }

    button {
        padding: 8px 16px;
        background-color: #333;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        width: 100%;
        min-height: 44px;
    }

    button:hover {
        background-color: #555;
    }

    p {
        margin-bottom: 8px;
        text-align: center;
    }

    .form-container {
        margin-bottom: 16px;
        color: #333;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        padding: 0 10px;
    }

    .result {
        padding: 10px;
        text-align: center;
        margin-top: 10px;
    }

    @media (min-width: 768px) {
        h1 {
            font-size: 1.75rem;
        }
        .form-container {
            width: 50%;
            margin: 0 auto;
            padding: 0;
        }
    }
</style>

<div>
    <div>
        <h1>Calculate Rebalance Amount</h1>
    </div>
    <div class="form-container">
        <h2>Select Accounts</h2>
        <select bind:value={selectedAccount1}>
            {#each accounts as [accountName, amount], index}
                <option value={index}>{accountName}</option>
            {/each}
        </select>
        <select bind:value={selectedAccount2}>
            {#each accounts as [accountName, amount], index}
                <option value={index}>{accountName}</option>
            {/each}
        </select>
        <h2>Enter Percentage</h2>
        <input type="number" min="0" max="100" bind:value={percentage} />
    <button on:click={calculateTransactionAmount}>Calculate</button>
    </div>
</div>

<!-- if negative: show: account2name pay account1name : amount, else swap the payee and receipt-->

<div class="result">
    {#if transactionAmount === undefined}
        <p>Enter the accounts and percentage to calculate the transaction amount</p>
    {:else if transactionAmount === 0}
        <p>No transaction needed</p>
    {:else if transactionAmount < 0}
        <p>{accountName1} pays {accountName2}: {Math.abs(transactionAmount)}</p>
    {:else}
        <p>{accountName2} pays {accountName1}: {Math.abs(transactionAmount)}</p>
    {/if}
</div>