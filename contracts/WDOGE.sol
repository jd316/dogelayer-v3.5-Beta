// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WDOGE is ERC20, Ownable, Pausable {
    address public bridge;
    
    constructor() ERC20("Wrapped Dogecoin", "wDOGE") {
        _transferOwnership(msg.sender);
        bridge = msg.sender;
    }
    
    function decimals() public pure override returns (uint8) {
        return 8; // Match Dogecoin's 8 decimals
    }
    
    function setBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid bridge address");
        bridge = _bridge;
    }
    
    function mint(address to, uint256 amount) external {
        require(msg.sender == bridge, "Only bridge can mint");
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external {
        require(msg.sender == bridge, "Only bridge can burn");
        _burn(from, amount);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw(address token) external onlyOwner {
        require(paused(), "Contract must be paused");
        if (token == address(0)) {
            payable(owner()).transfer(address(this).balance);
        } else {
            IERC20 tokenContract = IERC20(token);
            uint256 balance = tokenContract.balanceOf(address(this));
            require(balance > 0, "No tokens to withdraw");
            require(tokenContract.transfer(owner(), balance), "Transfer failed");
        }
    }
    
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
} 