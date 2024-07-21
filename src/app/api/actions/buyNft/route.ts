import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { ActionGetResponse, ActionPostResponse } from "@solana/actions";
import { PROGRAM_ID, CONNECTION, gmClientService, isValidNftName, getNftMint } from '@/lib/blink/actions';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const nftName = searchParams.get('nftName')?.toLowerCase();

    if (!nftName || !isValidNftName(nftName)) {
        return NextResponse.json({ error: 'Invalid or missing NFT name' }, { status: 400 });
    }

    const baseHref = new URL(`/api/actions/buy-nft?nftName=${nftName}`, request.url).toString();

    const payload: ActionGetResponse = {
        title: "Star Atlas NFT Purchase",
        icon: "https://staratlas.com/favicon.ico",
        description: `Purchase a ${nftName.toUpperCase()} NFT from the Star Atlas marketplace`,
        label: "Select NFT Order",
        links: {
            actions: [
                {
                    label: "Find Orders",
                    href: `${baseHref}&action=findOrders`,
                    parameters: [
                        {
                            name: "nftName",
                            label: "Enter NFT name (e.g., pearce x4)",
                            required: true,
                        }
                    ]
                }
            ]
        }
    };

    return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const nftName = searchParams.get('nftName')?.toLowerCase();
    const action = searchParams.get('action');
    const orderId = searchParams.get('orderId');
    const orderIdKey = new PublicKey(orderId as string);

    if (!nftName || !isValidNftName(nftName)) {
        return NextResponse.json({ error: 'Invalid or missing NFT name' }, { status: 400 });
    }

    const body = await request.json();
    const buyerPubkey = new PublicKey(body.account);

    const nftMint = getNftMint(nftName);
    if (!nftMint) {
        return NextResponse.json({ error: 'Invalid NFT name' }, { status: 400 });
    }

    if (action === 'findOrders') {
        const orders = await gmClientService.getOpenOrdersForAsset(CONNECTION, PROGRAM_ID, nftMint);
        const topOrders = orders.slice(0, 6).map(order => ({
            label: `Buy for ${order.uiPrice} ATLAS`,
            href: `/api/actions/buy-nft?nftName=${nftName}&action=buy&orderId=${order.id}`
        }));

        const payload: ActionGetResponse = {
            title: "Star Atlas NFT Purchase",
            icon: "https://staratlas.com/favicon.ico",
            description: `Select an order to purchase ${nftName.toUpperCase()} NFT`,
            label: "Select Order",
            links: { actions: topOrders }
        };

        return NextResponse.json(payload);
    } else if (action === 'buy' && orderId) {
        const order = await gmClientService.getOpenOrder(CONNECTION, PROGRAM_ID, orderIdKey);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const purchaseQty = 1; // Assuming we're buying 1 NFT
        const exchangeTx = await gmClientService.getCreateExchangeTransaction(
            CONNECTION,
            order,
            buyerPubkey,
            purchaseQty,
            PROGRAM_ID,
        );

        const serializedTransaction = exchangeTx.transaction.serialize({ requireAllSignatures: false }).toString('base64');

        const payload: ActionPostResponse = {
            transaction: serializedTransaction,
            message: `Purchase ${nftName.toUpperCase()} NFT for ${order.uiPrice} ATLAS`
        };

        return NextResponse.json(payload);
    } else {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
}
