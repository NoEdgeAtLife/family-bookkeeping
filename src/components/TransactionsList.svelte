<script>
  export let txs;
  export let accounts = [];
  export let deleteTransaction;
  export let editTransaction;
  let editingTxIndex = null;
  let editAmount;
  let editDate;
  let editDescription;
  let editFrom;
  let editTo;
  let itemsPerPage = 10;
  let searchQuery = "";
  $: orderedTxs = (txs || []).slice();
  $: filteredTxs = searchQuery.trim() 
    ? orderedTxs.filter(tx => String(tx[1].description || tx.descriptions || "").toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : orderedTxs;
  $: console.log("Debug: searchQuery =", searchQuery, ", filteredTxs count =", filteredTxs.length);
  $: console.log("Debug: searchQuery:", searchQuery, "filteredTxs:", filteredTxs);
  function debugFilter() {
      console.log("Debug Filter:");
      console.log("searchQuery:", searchQuery);
    console.log("orderedTxs count:", orderedTxs.length);
      console.log("filteredTxs count:", filteredTxs.length);
  }
  let currentPage = 1;
  $: maxPage = Math.ceil(filteredTxs.length / itemsPerPage);
  $: if (currentPage > maxPage) currentPage = 1;
  $: nextPage = () => currentPage < maxPage && currentPage++;
  $: previousPage = () => currentPage > 1 && currentPage--;
  $: goToPage = (page) => currentPage = page;
  $: paginatedTxs = filteredTxs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
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
  const startEdit = (index, tx) => {
    editingTxIndex = index;
    editAmount = tx.amount;
    editDate = tx.date;
    editDescription = tx.description;
    editFrom = tx.from;
    editTo = tx.to;
  };
  const cancelEdit = () => {
    editingTxIndex = null;
    editAmount = "";
    editDate = "";
    editDescription = "";
    editFrom = "";
    editTo = "";
  };
  </script>
  <div>
    <button on:click={exportTx}>export</button>
    <input type="text" placeholder="Search transactions by description" bind:value={searchQuery} on:input={() => currentPage = 1} />
  </div>
  <div class="table-wrapper">
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
            {#if editingTxIndex === index}
              <div class="edit-row">
                <input type="date" bind:value={editDate} />
                <select bind:value={editFrom}>
                  {#each accounts as [accountName]}
                    <option value={accountName}>{accountName}</option>
                  {/each}
                </select>
                <select bind:value={editTo}>
                  {#each accounts as [accountName]}
                    <option value={accountName}>{accountName}</option>
                  {/each}
                </select>
                <input type="number" bind:value={editAmount} placeholder="Amount" />
                <input type="text" bind:value={editDescription} placeholder="Description" />
              </div>
              <div class="action-row">
                <button class="primary" on:click={() => editTransaction(index, { amount: editAmount, date: editDate, description: editDescription, from: editFrom, to: editTo })}>Save</button>
                <button class="danger" on:click={() => deleteTransaction(index, tx)}>Delete</button>
                <button class="ghost" on:click={cancelEdit}>Cancel</button>
              </div>
            {:else}
              <button class="primary" on:click={() => startEdit(index, tx)}>Edit</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="pagination">
    <button on:click={previousPage} disabled={currentPage === 1}>Previous</button>
    {#each Array.from({ length: Math.ceil(filteredTxs.length / itemsPerPage) }) as _, i}
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
    <button on:click={nextPage} disabled={currentPage === Math.ceil(filteredTxs.length / itemsPerPage)}>Next</button>
  </div>

  <style>
    button {
      padding: 8px 16px;
      border: none;
      background-color: #007bff;
      color: #fff;
      cursor: pointer;
      border-radius: 4px;
      min-height: 44px;
      white-space: nowrap;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    button.primary {
      background-color: #007bff;
    }

    button.danger {
      background-color: #d92d20;
    }

    button.ghost {
      background-color: #6c757d;
    }

    .selected {
      font-weight: bold;
      background-color: #007bff;
      color: #fff;
    }

    .table-wrapper {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .table {
      display: table;
      width: 100%;
      border-collapse: collapse;
      min-width: 800px;
    }

    .table-header {
      display: table-row;
      font-weight: bold;
    }

    .table-cell {
      display: table-cell;
      padding: 10px;
      border: 1px solid #000;
      vertical-align: middle;
      white-space: nowrap;
    }

    .table-row {
      display: table-row;
    }

    .edit-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .edit-row input,
    .edit-row select {
      flex: 1;
      min-width: 120px;
      padding: 8px;
      min-height: 44px;
    }

    .action-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 10px;
      flex-wrap: wrap;
      gap: 5px;
    }

    .pagination button {
      margin: 0;
    }

    .pagination span {
      padding: 8px;
    }

    input[type="text"] {
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      min-height: 44px;
      width: 100%;
      max-width: 400px;
      margin-bottom: 10px;
    }

    @media (max-width: 768px) {
      .table {
        font-size: 0.875rem;
        min-width: 900px;
      }
      .table-cell {
        padding: 8px;
      }
      button {
        padding: 6px 12px;
        font-size: 0.875rem;
      }
      .edit-row input,
      .edit-row select {
        padding: 6px;
        font-size: 0.875rem;
      }
      .pagination button {
        padding: 8px 12px;
        font-size: 0.875rem;
      }
      input[type="text"] {
        max-width: 100%;
      }
    }
  </style>
