<script>
  export let txs;
  export let deleteTransaction;
  export let editTransaction;
  let showModal = false;
  let newAmount;
  let itemsPerPage = 10;
  $: txs = txs.slice().reverse();
  $: currentPage = 1;
  $: maxPage = Math.ceil(txs.length / itemsPerPage);
  $: nextPage = () => currentPage < maxPage && currentPage++;
  $: previousPage = () => currentPage > 1 && currentPage--;
  $: goToPage = (page) => currentPage = page;
  $: paginatedTxs = txs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  let exportTx = () => {
    const data = JSON.stringify(txs);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  </script>
  <div><button on:click={exportTx}>export</button></div>
  <div class="table">
    <div class="table-header">
      <div class="table-cell">Date</div>
      <div class="table-cell">From Account</div>
      <div class="table-cell">To Account</div>
      <div class="table-cell">Amount</div>
      <div class="table-cell">Descriptions</div>
      <div class="table-cell">Actions</div>
    </div>
    {#each paginatedTxs as [index, tx]}
      <div class="table-row">
        <div class="table-cell">{tx.date}</div>
        <div class="table-cell">{tx.from}</div>
        <div class="table-cell">{tx.to}</div>
        <div class="table-cell">{tx.amount}</div>
        <div class="table-cell">{tx.description}</div>
        <div class="table-cell">
          {#if showModal}
            <input type="number" bind:value={newAmount} placeholder="input amount" />
            <button on:click={() => editTransaction(index, tx.amount-newAmount)}>Save</button>
            <button on:click={() => deleteTransaction(index, tx)}>Delete</button>
            <button on:click={() => showModal = false}>Cancel</button>
          {:else}
            <button on:click={() => showModal = true}>Edit</button>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <div class="pagination">
    <button on:click={previousPage} disabled={currentPage === 1}>Previous</button>
    {#each Array.from({ length: Math.ceil(txs.length / itemsPerPage) }) as _, i}
      {#if i === 0 || (i >= currentPage - 1 && i <= currentPage + 1) || i === maxPage - 1}
      <button on:click={() => goToPage(i + 1)} class:selected={currentPage === i + 1}>{i + 1}</button>
      {/if}
      {#if i === currentPage + 2 && i !== maxPage - 1}
      <span>...</span>
      {/if}
      {#if i === 0 && currentPage > 3}
      <span>...</span>
      {/if}
    {/each}
    <button on:click={nextPage} disabled={currentPage === Math.ceil(txs.length / itemsPerPage)}>Next</button>
  </div>

  <style>
    button {
      padding: 5px 10px;
      border: none;
      background-color: #007bff;
      color: #fff;
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
    }

    .selected {
      font-weight: bold;
      background-color: #ddd;
    }

    .table {
        display: table;
        width: 100%;
        border-collapse: collapse;
    }

    .table-header {
        display: table-row;
        font-weight: bold;
    }

    .table-cell {
        display: table-cell;
        padding: 10px;
        border: 1px solid #000;
    }

    .table-row {
        display: table-row;
    }

    .pagination {
      display: flex;
      justify-content: center;
      margin-top: 10px;
    }

    .pagination button {
      margin: 0 5px;
    }

    .pagination button:selected {
      font-weight: bold;
    }

    @media (max-width: 600px) {
      .table-cell {
        display: block;
        padding: 10px;
        border: 1px solid #000;
      }
      .table-row {
        display: flex;
      }
    }

    @media (max-width: 600px) {
      .table-cell {
        display: block;
        padding: 10px;
        border: 1px solid #000;
      }
      .table-row {
        display: flex;
        margin-bottom: 10px;
        font: 10px;
      }
      .pagination {
        flex-direction: column;
        align-items: center;
      }
      .pagination button {
        margin: 5px 0;
      }
    }
  </style>
