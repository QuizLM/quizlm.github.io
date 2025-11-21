import React from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Toast } from '../lib/utils';

declare const Razorpay: any;
declare const Swal: any;

interface PaidServicesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PaidServicesModal: React.FC<PaidServicesModalProps> = ({ isOpen, onClose }) => {
    const { profile, updateProfile } = useAuth();

    if (!isOpen) return null;

    const handleUpgrade = async (plan: string, price: number) => {
        const planName = plan.charAt(0).toUpperCase() + plan.slice(1);

        // 1. Processing Overlay
        const overlay = document.createElement('div');
        overlay.id = 'payment-processing-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="loader-content">
                <p id="payment-processing-text">Creating secure payment order...</p>
                <span id="payment-processing-details">Please do not close this window.</span>
            </div>
        `;
        document.body.appendChild(overlay);

        try {
            // 2. Create Order
            const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
                body: { amount: price * 100, plan: plan },
            });

            if (orderError) throw orderError;

            // 3. Razorpay Checkout
            const options = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: "INR",
                name: "Quiz LM Upgrade",
                description: `${planName} Plan - Monthly Subscription`,
                order_id: orderData.id,
                handler: async function (response: any) {
                    // 4. Verify
                    const txt = document.getElementById('payment-processing-text');
                    if(txt) txt.textContent = 'Verifying your payment...';

                    const { data: verificationData, error: verificationError } = await supabase.functions.invoke('verify-razorpay-payment', {
                        body: {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            plan: plan,
                        },
                    });

                    document.body.removeChild(overlay);

                    if (verificationError || !verificationData.success) {
                        Swal.fire('Payment Failed', 'Your payment could not be verified.', 'error');
                    } else {
                        await updateProfile({ subscription_status: plan }); // Optimistic update
                        Swal.fire('Upgrade Successful!', `You are now on the ${planName} Plan.`, 'success');
                        onClose();
                    }
                },
                prefill: {
                    name: profile?.full_name || "Quiz LM User",
                    email: "", // Email handles by auth
                },
                theme: { color: "#3f51b5" },
                modal: {
                    ondismiss: function() {
                        document.body.removeChild(overlay);
                    }
                }
            };

            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (response: any) {
                document.body.removeChild(overlay);
                Swal.fire('Payment Failed', response.error.description, 'error');
            });
            rzp.open();

        } catch (err) {
            document.body.removeChild(overlay);
            console.error(err);
            Swal.fire('Error', 'Could not initiate payment.', 'error');
        }
    };

    const currentPlan = profile?.subscription_status || 'free';

    return (
        <div id="paid-services-overlay" className="content-modal-overlay visible" style={{display: 'flex'}} onClick={(e) => { if(e.target === e.currentTarget) onClose() }}>
            <div className="content-modal-panel wide-modal">
                <div className="content-modal-header">
                    <h2><i className="fas fa-gem"></i> Our Plans</h2>
                    <button id="paid-services-close-btn" className="content-modal-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="content-modal-body plans-container">
                    {/* Free Plan */}
                    <div className={`plan-card ${currentPlan === 'free' ? 'current-plan' : (currentPlan === 'spark' || currentPlan === 'pro') ? 'lower-plan' : ''}`}>
                        <div className="plan-header">
                            <h3>Free Plan</h3>
                            <p className="plan-price">₹0 <span>/ month</span></p>
                        </div>
                        <ul className="plan-features">
                            <li><i className="fas fa-check-circle"></i> 5 Quizzes/Documents per Day</li>
                            <li><i className="fas fa-check-circle"></i> 200 Question Attempts per Day</li>
                            <li><i className="fas fa-times-circle"></i> Unlimited Access</li>
                        </ul>
                        <button className="plan-button disabled-plan" disabled>
                            {currentPlan === 'free' ? 'Selected' : 'N/A'}
                        </button>
                    </div>
                    {/* Spark Plan */}
                    <div className={`plan-card recommended ${currentPlan === 'spark' ? 'current-plan' : (currentPlan === 'pro') ? 'lower-plan' : ''}`}>
                        <div className="plan-badge recommended-badge">Recommended</div>
                        <div className="plan-header">
                            <h3>Spark Plan</h3>
                            <p className="plan-price">₹29 <span>/ month</span></p>
                        </div>
                        <ul className="plan-features">
                            <li><i className="fas fa-check-circle"></i> 25 Quizzes/Documents per Day</li>
                            <li><i className="fas fa-check-circle"></i> 1000 Question Attempts per Day</li>
                        </ul>
                        <button className="plan-button"
                            onClick={() => handleUpgrade('spark', 29)}
                            disabled={currentPlan === 'spark' || currentPlan === 'pro'}
                        >
                            {currentPlan === 'spark' ? 'Your Current Plan' : 'Upgrade Now'}
                        </button>
                    </div>
                    {/* Pro Plan */}
                    <div className={`plan-card ${currentPlan === 'pro' ? 'current-plan' : ''}`}>
                        <div className="plan-header">
                            <h3>Pro Plan</h3>
                            <p className="plan-price">₹49 <span>/ month</span></p>
                        </div>
                        <ul className="plan-features">
                            <li><i className="fas fa-check-circle"></i> Unlimited Quizzes & Documents</li>
                            <li><i className="fas fa-check-circle"></i> Unlimited Question Attempts</li>
                        </ul>
                        <button className="plan-button"
                             onClick={() => handleUpgrade('pro', 49)}
                             disabled={currentPlan === 'pro'}
                        >
                             {currentPlan === 'pro' ? 'Your Current Plan' : 'Upgrade Now'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
