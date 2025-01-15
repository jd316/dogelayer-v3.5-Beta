// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract WDOGELending is ReentrancyGuard, Ownable, Pausable {
    IERC20 public wdoge;
    
    uint256 public constant COLLATERAL_RATIO = 150; // 150% collateralization required
    uint256 public constant LIQUIDATION_THRESHOLD = 130; // 130% threshold for liquidation
    uint256 public constant INTEREST_RATE = 500; // 5% annual interest rate
    uint256 public constant RATE_PRECISION = 10000;
    
    struct Loan {
        uint256 amount;
        uint256 collateral;
        uint256 timestamp;
        uint256 interestPaid;
    }
    
    mapping(address => Loan) public loans;
    uint256 public totalLoaned;
    uint256 public totalCollateral;
    
    event LoanCreated(address indexed borrower, uint256 amount, uint256 collateral);
    event LoanRepaid(address indexed borrower, uint256 amount, uint256 interest);
    event CollateralAdded(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, uint256 amount);
    event LoanLiquidated(address indexed borrower, address indexed liquidator, uint256 amount);
    
    constructor(address _wdoge) {
        _transferOwnership(msg.sender);
        wdoge = IERC20(_wdoge);
    }
    
    function borrow(uint256 amount, uint256 collateralAmount) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot borrow 0");
        require(collateralAmount > 0, "Cannot provide 0 collateral");
        require(loans[msg.sender].amount == 0, "Existing loan must be repaid first");
        
        uint256 requiredCollateral = (amount * COLLATERAL_RATIO) / 100;
        require(collateralAmount >= requiredCollateral, "Insufficient collateral");
        
        // Transfer collateral to contract
        require(wdoge.transferFrom(msg.sender, address(this), collateralAmount), "Collateral transfer failed");
        
        // Create loan
        loans[msg.sender] = Loan({
            amount: amount,
            collateral: collateralAmount,
            timestamp: block.timestamp,
            interestPaid: 0
        });
        
        totalLoaned += amount;
        totalCollateral += collateralAmount;
        
        // Transfer borrowed amount
        require(wdoge.transfer(msg.sender, amount), "Loan transfer failed");
        
        emit LoanCreated(msg.sender, amount, collateralAmount);
    }
    
    function repay(uint256 amount) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(loan.amount > 0, "No active loan");
        require(amount > 0, "Cannot repay 0");
        
        // Calculate interest
        uint256 timeElapsed = block.timestamp - loan.timestamp;
        uint256 interest = (loan.amount * INTEREST_RATE * timeElapsed) / (365 days * RATE_PRECISION);
        
        uint256 totalDue = loan.amount + interest - loan.interestPaid;
        require(amount <= totalDue, "Amount exceeds loan + interest");
        
        // Transfer repayment
        require(wdoge.transferFrom(msg.sender, address(this), amount), "Repayment transfer failed");
        
        // Update loan
        if (amount == totalDue) {
            // Full repayment
            totalLoaned -= loan.amount;
            totalCollateral -= loan.collateral;
            
            // Return collateral
            require(wdoge.transfer(msg.sender, loan.collateral), "Collateral return failed");
            
            delete loans[msg.sender];
        } else {
            // Partial repayment
            loan.amount -= amount;
            loan.interestPaid += (amount > interest) ? interest : amount;
            loan.timestamp = block.timestamp;
        }
        
        emit LoanRepaid(msg.sender, amount, interest);
    }
    
    function addCollateral(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Cannot add 0 collateral");
        require(loans[msg.sender].amount > 0, "No active loan");
        
        require(wdoge.transferFrom(msg.sender, address(this), amount), "Collateral transfer failed");
        
        loans[msg.sender].collateral += amount;
        totalCollateral += amount;
        
        emit CollateralAdded(msg.sender, amount);
    }
    
    function withdrawExcessCollateral(uint256 amount) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        require(loan.amount > 0, "No active loan");
        require(amount > 0, "Cannot withdraw 0");
        
        uint256 requiredCollateral = (loan.amount * COLLATERAL_RATIO) / 100;
        uint256 excessCollateral = loan.collateral - requiredCollateral;
        require(amount <= excessCollateral, "Insufficient excess collateral");
        
        loan.collateral -= amount;
        totalCollateral -= amount;
        
        require(wdoge.transfer(msg.sender, amount), "Collateral withdrawal failed");
        
        emit CollateralWithdrawn(msg.sender, amount);
    }
    
    function liquidate(address borrower) external nonReentrant whenNotPaused {
        Loan storage loan = loans[borrower];
        require(loan.amount > 0, "No active loan");
        
        // Check if loan is undercollateralized
        uint256 timeElapsed = block.timestamp - loan.timestamp;
        uint256 interest = (loan.amount * INTEREST_RATE * timeElapsed) / (365 days * RATE_PRECISION);
        uint256 totalDue = loan.amount + interest - loan.interestPaid;
        
        uint256 currentRatio = (loan.collateral * 100) / totalDue;
        require(currentRatio < LIQUIDATION_THRESHOLD, "Loan not liquidatable");
        
        // Transfer repayment from liquidator
        require(wdoge.transferFrom(msg.sender, address(this), totalDue), "Liquidation payment failed");
        
        // Transfer collateral to liquidator
        require(wdoge.transfer(msg.sender, loan.collateral), "Collateral transfer failed");
        
        totalLoaned -= loan.amount;
        totalCollateral -= loan.collateral;
        
        emit LoanLiquidated(borrower, msg.sender, totalDue);
        
        delete loans[borrower];
    }
    
    function getLoanInfo(address borrower) external view returns (
        uint256 loanAmount,
        uint256 collateralAmount,
        uint256 interestDue,
        uint256 collateralRatio
    ) {
        Loan memory loan = loans[borrower];
        loanAmount = loan.amount;
        collateralAmount = loan.collateral;
        
        if (loan.amount > 0) {
            uint256 timeElapsed = block.timestamp - loan.timestamp;
            interestDue = (loan.amount * INTEREST_RATE * timeElapsed) / (365 days * RATE_PRECISION) - loan.interestPaid;
            collateralRatio = (loan.collateral * 100) / (loan.amount + interestDue);
        }
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
} 