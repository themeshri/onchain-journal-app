#!/bin/bash

# Script to safely remove old API routes after migration
# Run this after verifying the new consolidated endpoints work

echo "API Route Consolidation Cleanup Script"
echo "======================================="
echo ""
echo "This script will remove the following old API routes:"
echo "- defi-activities"
echo "- free-rpc-swaps"
echo "- gmgn-swaps"
echo "- real-swaps"
echo "- simple-swaps"
echo "- solscan-swaps"
echo "- swaps-only"
echo "- test-swaps"
echo "- transactions-helius"
echo "- transactions-public"
echo "- transactions-rpc"
echo "- transactions-v1"
echo "- transactions"
echo ""
echo "And keep these consolidated endpoints:"
echo "✓ /api/swaps (main swap endpoint)"
echo "✓ /api/transactions-all (general transactions)"
echo "✓ /api/helius-swaps (keeping temporarily for compatibility)"
echo ""
read -p "Are you sure you want to remove the old API routes? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "Creating backup..."
    mkdir -p ./backup/api-routes
    
    # Backup old routes
    for route in defi-activities free-rpc-swaps gmgn-swaps real-swaps simple-swaps solscan-swaps swaps-only test-swaps transactions-helius transactions-public transactions-rpc transactions-v1 transactions; do
        if [ -d "app/api/$route" ]; then
            cp -r "app/api/$route" "./backup/api-routes/"
            echo "Backed up: $route"
        fi
    done
    
    echo ""
    echo "Removing old API routes..."
    
    # Remove old routes
    rm -rf app/api/defi-activities
    rm -rf app/api/free-rpc-swaps
    rm -rf app/api/gmgn-swaps
    rm -rf app/api/real-swaps
    rm -rf app/api/simple-swaps
    rm -rf app/api/solscan-swaps
    rm -rf app/api/swaps-only
    rm -rf app/api/test-swaps
    rm -rf app/api/transactions-helius
    rm -rf app/api/transactions-public
    rm -rf app/api/transactions-rpc
    rm -rf app/api/transactions-v1
    rm -rf app/api/transactions
    
    echo ""
    echo "✅ Cleanup complete!"
    echo "Backup created at: ./backup/api-routes/"
    echo ""
    echo "Remaining API routes:"
    ls -la app/api/
else
    echo "Cleanup cancelled."
fi