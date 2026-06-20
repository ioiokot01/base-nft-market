// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Deployed NFTMarketplace on Base Sepolia (chainId 84532).
// https://sepolia.basescan.org/address/0xE7C5B54ADeAEdFa91Ac38E4b1ec43d6C5541eF18
const CONTRACT_ADDRESS = "0xE7C5B54ADeAEdFa91Ac38E4b1ec43d6C5541eF18";

// Prefilled default NFT: the MiniNFT collection from project 3 (Base Sepolia).
const DEFAULT_NFT = "0xA17CEfaa527aAd9FAe10012D2457200BD4832079";

const ABI = [
  "function list(address nft, uint256 tokenId, uint256 price) external returns (uint256)",
  "function buy(uint256 id) external payable",
  "function cancel(uint256 id) external",
  "function updatePrice(uint256 id, uint256 newPrice) external",
  "function listingCount() view returns (uint256)",
  "function getListing(uint256 id) view returns (address seller, address nft, uint256 tokenId, uint256 price, bool active)",
  "function feeBps() view returns (uint256)",
  "event Listed(uint256 indexed id, address indexed seller, address indexed nft, uint256 tokenId, uint256 price)",
  "event Purchased(uint256 indexed id, address indexed buyer, uint256 price)",
  "event Cancelled(uint256 indexed id)",
  "event PriceUpdated(uint256 indexed id, uint256 newPrice)",
];

const NFT_ABI = [
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
];

// ---------------------------------------------------------------------------
// State + refs
// ---------------------------------------------------------------------------

let provider, signer, contract, account;

const els = {
  connectBtn: document.getElementById("connectBtn"),
  account: document.getElementById("account"),
  listCard: document.getElementById("listCard"),
  nftInput: document.getElementById("nftInput"),
  tokenIdInput: document.getElementById("tokenIdInput"),
  priceInput: document.getElementById("priceInput"),
  approveBtn: document.getElementById("approveBtn"),
  listBtn: document.getElementById("listBtn"),
  status: document.getElementById("status"),
  count: document.getElementById("count"),
  refreshBtn: document.getElementById("refreshBtn"),
  listings: document.getElementById("listings"),
  empty: document.getElementById("empty"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.className = "status" + (kind ? " " + kind : "");
}

function short(a) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function fmtEth(wei) {
  return parseFloat(ethers.formatEther(wei)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

async function connect() {
  if (!window.ethereum) {
    setStatus("No wallet found. Install MetaMask or Coinbase Wallet.", "error");
    return;
  }
  if (!CONTRACT_ADDRESS) {
    setStatus("Set CONTRACT_ADDRESS in app.js after deploying.", "error");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = (await signer.getAddress()).toLowerCase();

    els.account.textContent = "Connected: " + short(account);
    els.account.classList.remove("hidden");
    els.connectBtn.textContent = "Connected";

    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    els.listCard.classList.remove("hidden");
    els.refreshBtn.disabled = false;
    if (!els.nftInput.value) els.nftInput.value = DEFAULT_NFT;

    await refresh();
    ["Listed", "Purchased", "Cancelled", "PriceUpdated"].forEach((e) =>
      contract.on(e, () => refresh())
    );
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Failed to connect.", "error");
  }
}

// ---------------------------------------------------------------------------
// Read + render
// ---------------------------------------------------------------------------

async function refresh() {
  if (!contract) return;
  setStatus("Loading…");
  try {
    const count = Number(await contract.listingCount());

    const ids = [...Array(count).keys()];
    const all = await Promise.all(ids.map((id) => contract.getListing(id)));
    const active = ids
      .map((id) => ({ id, l: all[id] }))
      .filter((x) => x.l.active)
      .reverse();

    els.count.textContent = active.length ? `(${active.length})` : "";

    if (active.length === 0) {
      els.listings.innerHTML = "";
      els.empty.classList.remove("hidden");
      setStatus("");
      return;
    }
    els.empty.classList.add("hidden");

    els.listings.innerHTML = "";
    active.forEach(renderListing);
    setStatus("");
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Failed to load.", "error");
  }
}

function renderListing({ id, l }) {
  const isSeller = l.seller.toLowerCase() === account;

  const row = document.createElement("div");
  row.className = "listing";

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  thumb.textContent = "#" + l.tokenId;

  const info = document.createElement("div");
  info.className = "listing-info";
  const title = document.createElement("div");
  title.className = "listing-title";
  title.textContent = `Token #${l.tokenId}`;
  const sub = document.createElement("div");
  sub.className = "listing-sub";
  sub.textContent = `${short(l.nft)} · seller ${short(l.seller)}`;
  const price = document.createElement("div");
  price.className = "listing-price";
  price.textContent = fmtEth(l.price) + " ETH";
  info.append(title, sub, price);

  const actions = document.createElement("div");
  actions.className = "listing-actions";

  if (isSeller) {
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-ghost";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => send(() => contract.cancel(id), "Cancelling"));
    actions.appendChild(cancelBtn);
  } else {
    const buyBtn = document.createElement("button");
    buyBtn.className = "btn";
    buyBtn.textContent = "Buy";
    buyBtn.addEventListener("click", () =>
      send(() => contract.buy(id, { value: l.price }), "Buying")
    );
    actions.appendChild(buyBtn);
  }

  row.append(thumb, info, actions);
  els.listings.appendChild(row);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function approve() {
  const nft = els.nftInput.value.trim();
  const tokenId = els.tokenIdInput.value.trim();
  if (!ethers.isAddress(nft)) return setStatus("Enter a valid NFT address.", "error");
  if (tokenId === "") return setStatus("Enter a token ID.", "error");
  const nftContract = new ethers.Contract(nft, NFT_ABI, signer);
  await send(() => nftContract.approve(CONTRACT_ADDRESS, tokenId), "Approving");
}

async function listNft() {
  const nft = els.nftInput.value.trim();
  const tokenId = els.tokenIdInput.value.trim();
  if (!ethers.isAddress(nft)) return setStatus("Enter a valid NFT address.", "error");
  if (tokenId === "") return setStatus("Enter a token ID.", "error");
  let price;
  try {
    price = ethers.parseEther((els.priceInput.value || "").trim() || "0");
  } catch {
    return setStatus("Enter a valid price.", "error");
  }
  if (price <= 0n) return setStatus("Price must be greater than 0.", "error");

  await send(() => contract.list(nft, tokenId, price), "Listing");
  els.tokenIdInput.value = "";
  els.priceInput.value = "";
}

async function send(action, label) {
  try {
    setStatus("Confirm in your wallet…");
    const tx = await action();
    setStatus(label + "…");
    await tx.wait();
    setStatus("Done ✅", "ok");
    await refresh();
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Transaction failed.", "error");
  }
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------

els.connectBtn.addEventListener("click", connect);
els.approveBtn.addEventListener("click", approve);
els.listBtn.addEventListener("click", listNft);
els.refreshBtn.addEventListener("click", refresh);

if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", () => window.location.reload());
  window.ethereum.on?.("chainChanged", () => window.location.reload());
}
